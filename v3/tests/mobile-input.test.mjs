import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {bindMobileInput} from '../mobile-input.mjs';
import {DrivingController,DRIVE_MODE,SPAWN,moveVehicle} from '../driving.mjs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const takeover=app.slice(app.indexOf('function takeManualControl()'),app.indexOf('const drivingKeys='));
const manual=app.slice(app.indexOf('function manualInput()'),app.indexOf('function updateInterface()'));
function fixture(mode=DRIVE_MODE.EXPLORE){
  const listeners=new Map(),captures=new Set(),keys=new Set(),touch=new Set();
  const buttons=['forward','reverse','left','right','brake'].map((drive,i)=>({
    dataset:{drive},disabled:false,index:i,
    classList:{active:false,toggle(_,v){this.active=v;}},closest(){return this;},
  }));
  const root={querySelectorAll:()=>buttons,ownerDocument:{elementFromPoint:x=>buttons[x]||null},
    addEventListener:(name,fn)=>listeners.set(name,fn),setPointerCapture:id=>captures.add(id),
    hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
  const driving=new DrivingController({...SPAWN});driving.mode=mode;
  let modal=false,phone=true,takeovers=0;
  const nodes={'#mobile-controls':root,'#journey-title':{textContent:'正前往关于我的小屋'},'#drive-status':{textContent:'正在自动驾驶前往关于我的小屋。'}};
  const context=vm.createContext({keys,touch,driving,DRIVE_MODE,pendingDestination:'about',$:s=>nodes[s],
    phoneLayout:{get matches(){return phone;}},isModalOpen:()=>modal,contextLost:false,
    bindMobileInput:(root,touch,canDrive,takeControl)=>bindMobileInput(root,touch,canDrive,()=>{takeovers++;takeControl();})});
  vm.runInContext(takeover+manual+'let mobileInput;'+app.slice(app.indexOf('mobileInput=bindMobileInput('),app.indexOf("$('#mobile-controls').setAttribute")),context);
  const input=vm.runInContext('mobileInput',context);
  const value=()=>vm.runInContext('manualInput()',context);
  const fire=(type,id,index=0)=>listeners.get(type)({pointerId:id,target:buttons[index],clientX:index,clientY:0,button:0,preventDefault(){}});
  return {input,keys,touch,buttons,driving,fire,value,root,nodes,context,get takeovers(){return takeovers;},setModal(v){modal=v;},setPhone(v){phone=v;}};
}
test('touch hold continuously drives through the existing controller and release decelerates',()=>{
  const f=fixture();f.fire('pointerdown',1,0);
  for(let i=0;i<120;i++)f.driving.update(f.value(),1/60);
  assert.ok(f.driving.vehicle.z<SPAWN.z-5);assert.ok(f.driving.vehicle.speed>5);
  f.fire('pointerup',1);assert.equal(f.value().throttle,0);
  for(let i=0;i<240;i++)f.driving.update(f.value(),1/60);
  assert.equal(f.driving.vehicle.speed,0);assert.equal(f.driving.mode,DRIVE_MODE.EXPLORE);
});
test('multi-touch combines acceleration and steering and releases only the matching pointer',()=>{
  const f=fixture();f.fire('pointerdown',1,0);f.fire('pointerdown',2,2);
  assert.equal(f.value().throttle,1);assert.equal(f.value().steer,1);
  for(let i=0;i<60;i++)f.driving.update(f.value(),1/60);
  assert.ok(f.driving.vehicle.angle>Math.PI);f.fire('pointerup',2);
  assert.equal(f.value().steer,0);assert.equal(f.value().throttle,1);
  f.fire('pointerdown',3,0);f.fire('pointerup',1);assert.equal(f.value().throttle,1);
  f.fire('pointerup',3);assert.equal(f.touch.size,0);
});
test('drag switches buttons, leaving controls releases input, and cancel/capture-loss clear it',()=>{
  const f=fixture();f.fire('pointerdown',1,0);f.fire('pointermove',1,1);
  assert.equal(f.value().throttle,-1);assert.equal(f.buttons[0].classList.active,false);
  f.fire('pointermove',1,99);assert.equal(f.touch.size,0);
  f.fire('pointermove',1,0);assert.equal(f.value().throttle,1);
  f.fire('pointercancel',1);assert.equal(f.touch.size,0);
  f.fire('pointerdown',2,0);f.fire('lostpointercapture',2);assert.equal(f.touch.size,0);
});
test('AUTO_CRUISE and LOCATION_OPEN reject all touch input',()=>{
  for(const mode of [DRIVE_MODE.AUTO_CRUISE,DRIVE_MODE.LOCATION_OPEN]){
    const f=fixture(mode),baseline=new DrivingController({...SPAWN});baseline.mode=mode;
    f.fire('pointerdown',1,0);f.fire('pointermove',1,2);
    assert.equal(f.touch.size,0);assert.equal(f.takeovers,0);assert.ok(f.buttons.every(b=>b.disabled));
    for(let i=0;i<120;i++){f.driving.update(f.value(),1/60);baseline.update({},1/60);}
    assert.deepEqual(f.driving.vehicle,baseline.vehicle);assert.equal(f.driving.mode,baseline.mode);
  }
});
test('modal, blur/hidden clearing, layout changes and state changes cannot leave stuck pointers',()=>{
  const f=fixture();f.fire('pointerdown',1,0);f.input.clear();f.fire('pointermove',1,0);assert.equal(f.touch.size,0);
  assert.match(app,/window\.addEventListener\('blur',clearInput\)/);
  assert.match(app,/visibilitychange',\(\)=>\{clearInput\(\)/);
  assert.match(app,/function clearInput\(\)\{keys.clear\(\);mobileInput\?\.clear\(\)/);
  for(const change of [()=>f.setModal(true),()=>f.setPhone(false),()=>{f.driving.mode=DRIVE_MODE.LOCATION_OPEN;}]){
    f.setModal(false);f.setPhone(true);f.driving.mode=DRIVE_MODE.EXPLORE;f.input.sync();f.fire('pointerdown',2,0);
    change();f.input.sync();assert.equal(f.touch.size,0);f.fire('pointermove',2,0);assert.equal(f.touch.size,0);
  }
});
test('desktop keyboard handling still drives, steers, brakes, and cancels destination driving',()=>{
  const f=fixture(),handlers=new Map();f.setPhone(false);f.input.sync();
  const context=vm.createContext({keys:f.keys,touch:f.touch,driving:f.driving,DRIVE_MODE,started:true,isModalOpen:()=>false,
    window:{addEventListener:(name,fn)=>handlers.set(name,fn)},HTMLInputElement:class{},HTMLTextAreaElement:class{},
    $:s=>f.nodes[s],nearby:null,toggleView(){},resetCar(){},openChapter(){}});
  const start=app.indexOf('const drivingKeys='),end=app.indexOf("window.addEventListener('keyup'");
  vm.runInContext(takeover+app.slice(start,end)+manual,context);
  const press=key=>handlers.get('keydown')({key,target:{closest:()=>null},preventDefault(){},repeat:false});
  assert.ok(f.driving.goTo('about'));const before={...f.driving.vehicle};press('w');assert.equal(f.driving.destination,null);
  assert.deepEqual(f.driving.vehicle,before);assert.equal(f.driving.route.length,0);assertTakeoverText(f);
  press('a');for(let i=0;i<60;i++)f.driving.update(vm.runInContext('manualInput()',context),1/60);
  assert.ok(f.driving.vehicle.speed>0);assert.ok(f.driving.vehicle.angle>Math.PI);
  f.keys.clear();press(' ');for(let i=0;i<30;i++)f.driving.update(vm.runInContext('manualInput()',context),1/60);
  assert.equal(f.driving.vehicle.speed,0);assert.equal(f.touch.size,0);
  assert.equal((app.match(/requestAnimationFrame\(loop\)/g)||[]).length,2);
  assert.equal((app.match(/driving\.update\(/g)||[]).length,1);
});

function assertTakeoverText(f){
  assert.equal(f.nodes['#journey-title'].textContent,'方向盘交给你了。');
  assert.equal(f.nodes['#drive-status'].textContent,'已取消自动带路。可手动驾驶，进入地点有效区域后自动打开内容。');
}
function beginReturn(f){
  Object.assign(f.driving.vehicle,{x:0,z:4,angle:0});f.driving.startExploring();
  for(let i=0;i<30;i++)f.driving.update({},1/60);
  assert.equal(f.driving.mode,DRIVE_MODE.RETURNING_TO_START);assert.ok(f.driving.route.length);
  f.input.sync();
}
function assertReturnTakeover(f,context){
  assert.equal(f.driving.mode,DRIVE_MODE.EXPLORE);assert.equal(f.driving.destination,null);
  assert.deepEqual(f.driving.route,[]);assert.equal(context.pendingDestination,null);
  const expected={...f.driving.vehicle};
  f.driving.followRoute=()=>assert.fail('automatic driving must not run after manual takeover');
  // Run the actual app frame, including its return-completion handling.
  const frameContext=vm.createContext({...context,vehicle:f.driving.vehicle,keys:f.keys,touch:f.touch,
    world:{render(){}},contextLost:false,document:{hidden:false},isModalOpen:()=>false,
    requestAnimationFrame(){},lastTime:1000,elapsed:0,frame:0,previewPaused:false,reduced:{matches:false},
    clearInput(){assert.fail('takeover input must survive the frame');},
    go(){assert.fail('pending navigation must not restart');},toast(){},openChapter(){}});
  vm.runInContext(manual+app.slice(app.indexOf('function loop('),app.indexOf('function showFallback(')),frameContext);
  moveVehicle(expected,f.value(),1/60);
  vm.runInContext('loop(1000+1000/60)',frameContext);
  for(const key of ['x','z','angle','speed'])assert.ok(Math.abs(f.driving.vehicle[key]-expected[key])<1e-10,key);
}
test('return takeover: all desktop direction keys cancel return immediately and retain input through the app frame',()=>{
  for(const key of ['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
    const f=fixture(),handlers=new Map();beginReturn(f);f.setPhone(false);
    const context=vm.createContext({keys:f.keys,touch:f.touch,driving:f.driving,DRIVE_MODE,pendingDestination:'about',
      started:true,isModalOpen:()=>false,window:{addEventListener:(name,fn)=>handlers.set(name,fn)},
      HTMLInputElement:class{},HTMLTextAreaElement:class{},$:s=>f.nodes[s],nearby:null,toggleView(){},resetCar(){},openChapter(){}});
    vm.runInContext(takeover+app.slice(app.indexOf('const drivingKeys='),app.indexOf("window.addEventListener('keyup'")),context);
    const before={...f.driving.vehicle};
    handlers.get('keydown')({key,target:{closest:()=>null},preventDefault(){},repeat:false});
    assert.deepEqual(f.driving.vehicle,before);assert.ok(f.keys.has(key.toLowerCase()));
    assertReturnTakeover(f,context);
  }
});
test('return takeover: every existing touch driving button cancels return and keeps its held input',()=>{
  for(let button=0;button<5;button++){
    const f=fixture();beginReturn(f);assert.ok(f.buttons.every(b=>!b.disabled));
    const before={...f.driving.vehicle};f.fire('pointerdown',1,button);
    assert.deepEqual(f.driving.vehicle,before);assert.ok(f.touch.has(f.buttons[button].dataset.drive));
    assertReturnTakeover(f,f.context);
    f.fire('pointerup',1);assert.equal(f.touch.size,0);
  }
});
test('stage 3B: touch takeover immediately cancels navigation and synchronizes both messages',()=>{
  for(let button=0;button<5;button++){
    const f=fixture();assert.ok(f.driving.goTo('about'));
    const before={...f.driving.vehicle};f.fire('pointerdown',1,button);
    assert.equal(f.driving.destination,null);assert.equal(f.driving.route.length,0);
    assert.deepEqual(f.driving.vehicle,before);assertTakeoverText(f);
    assert.ok(f.touch.has(f.buttons[button].dataset.drive));
  }
  const f=fixture();f.nodes['#journey-title'].textContent='手动探索';
  f.nodes['#drive-status'].textContent='探索提示';f.fire('pointerdown',1);
  assert.equal(f.nodes['#journey-title'].textContent,'手动探索');
  assert.equal(f.nodes['#drive-status'].textContent,'探索提示');
});
