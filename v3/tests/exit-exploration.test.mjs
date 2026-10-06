import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {SPAWN,STATIONS,DrivingController,DRIVE_MODE,insideLocation} from '../driving.mjs';
import {PHONE_LAYOUT,bindMobileInput} from '../mobile-input.mjs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fixture(){
  const nodes=new Map(),timers=new Map(),events=[];let timerId=0,rafCount=0;
  function element(id=''){
    const classes=new Set(),handlers=new Map(),captures=new Set();
    return {id,dataset:{},style:{},hidden:false,disabled:false,open:false,textContent:'',innerHTML:'',
      clientWidth:1024,clientHeight:768,offsetWidth:100,offsetHeight:50,
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),
        toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},
      addEventListener:(name,fn)=>handlers.set(name,fn),
      emit(name,e={}){handlers.get(name)?.(e);},click(){this.emit('click');},
      setAttribute(name,value){this[name]=value;},append(){},focus(){this.focused=true;},
      showModal(){this.open=true;},close(){if(this.open){this.open=false;events.push(()=>this.emit('close'));}},
      closest(){return this;},querySelectorAll:()=>buttons,
      ownerDocument:{elementFromPoint:()=>null},setPointerCapture:id=>captures.add(id),
      hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),captures,
    };
  }
  const buttons=['forward','left','reverse','right','brake'].map(d=>{const b=element();b.dataset.drive=d;return b;});
  const $=s=>{if(!nodes.has(s))nodes.set(s,element(s.slice(1)));return nodes.get(s);};
  const dialogs=['journal','photo-dialog','help-dialog'].map(id=>$(`#${id}`));
  const all=s=>s==='dialog'?dialogs:s==='dialog[open]'?dialogs.filter(d=>d.open):s==='[data-drive]'?buttons:[];
  const document={body:element(),querySelector:s=>s==='dialog[open]'?dialogs.find(d=>d.open)||null:$(s),
    querySelectorAll:all,createElement:()=>element(),addEventListener(){}};
  const world={started:false,overview:false,userZoom:1,orbit:.61,resizes:0,
    resize(){this.resizes++;},project:()=>({x:400,y:300,visible:true})};
  const context=vm.createContext({SPAWN,STATIONS,DrivingController,DRIVE_MODE,insideLocation,PHONE_LAYOUT,bindMobileInput,
    document,window:{addEventListener(){}},matchMedia:()=>({matches:true,addEventListener(){}}),
    localStorage:{getItem:()=>null,setItem(){}},
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),
    requestAnimationFrame(){rafCount++;},testWorld:world});
  vm.runInContext(app.replace(/^import .*;\n/gm,'').slice(0,app.replace(/^import .*;\n/gm,'').indexOf('try {\n  const {IslandWorld}')),context);
  vm.runInContext('world=testWorld;',context);
  const run=code=>vm.runInContext(code,context);
  const driver=run('driving'),keys=run('keys'),touch=run('touch');
  return {$,run,driver,keys,touch,world,document,buttons,timers,
    flushEvents(){while(events.length)events.shift()();},flushTimers(){for(const [id,fn] of timers){timers.delete(id);fn();}},
    get rafCount(){return rafCount;}};
}
function assertWelcome(f){
  assert.equal(f.run('started'),false);assert.equal(f.driver.mode,DRIVE_MODE.AUTO_CRUISE);
  assert.equal(f.driver.destination,null);assert.equal(f.run('pendingDestination'),null);
  assert.equal(f.driver.location,null);assert.equal(f.driver.error,null);assert.equal(f.driver.route.length,0);
  assert.equal(f.keys.size,0);assert.equal(f.touch.size,0);assert.equal(f.driver.vehicle.speed,0);
  assert.equal(f.$('#welcome').hidden,false);assert.equal(f.$('#welcome').classList.contains('leaving'),false);
  assert.equal(f.document.body.classList.contains('exploring'),false);
  for(const id of ['exit-button','exploration-status','mobile-controls','destination-prompt'])assert.equal(f.$(`#${id}`).hidden,true,id);
  assert.equal(f.$('#preview-toggle').hidden,false);assert.equal(f.run('previewPaused'),false);
  assert.equal(f.world.started,false);assert.equal(f.world.overview,false);assert.equal(f.world.userZoom,1);
  assert.equal(f.$('#start-button').disabled,false);assert.equal(f.$('#start-button').focused,true);
}
test('exit exploration: EXPLORE restores welcome and clears temporary UI while preserving discoveries',()=>{
  const f=fixture();f.$('#start-button').click();f.driver.takeControl();
  f.run("visited.add('about');nearby=STATIONS[0];activeChapter=2;previewPaused=true;world.overview=true;world.userZoom=1.7;toast('导航提示');");
  f.$('#destination-prompt').hidden=false;f.$('#exit-button').click();assertWelcome(f);
  assert.equal(f.run('nearby'),null);assert.equal(f.run('activeChapter'),0);
  assert.equal(f.run("visited.has('about')"),true);assert.equal(f.$('#toast').textContent,'');
  f.flushTimers();assert.equal(f.$('#welcome').hidden,false);
});
test('exit exploration: held keyboard and captured touch inputs are fully released',()=>{
  const f=fixture();f.$('#start-button').click();f.driver.takeControl();f.keys.add('w');f.keys.add('a');
  const root=f.$('#mobile-controls');root.emit('pointerdown',{target:f.buttons[0],pointerId:1,button:0,preventDefault(){}});
  assert.equal(root.captures.size,1);assert.ok(f.touch.has('forward'));
  f.driver.update(f.run('manualInput()'),1/60);f.$('#exit-button').click();assertWelcome(f);
  assert.equal(root.captures.size,0);assert.ok(f.buttons.every(b=>!b.classList.contains('active')&&b.disabled));
  root.emit('pointermove',{pointerId:1});assert.equal(f.touch.size,0);
});
test('exit exploration: destination navigation and return routes are cancelled before cruise resumes',()=>{
  for(const navigating of [true,false]){
    const f=fixture();Object.assign(f.driver.vehicle,{x:0,z:4,angle:0});f.$('#start-button').click();
    if(navigating){f.driver.takeControl();assert.ok(f.driver.goTo('work'));}
    f.run("pendingDestination='about'");assert.ok(f.driver.route.length);
    const before={...f.driver.vehicle};f.$('#exit-button').click();assertWelcome(f);
    assert.equal(f.driver.vehicle.x,before.x);assert.equal(f.driver.vehicle.z,before.z);
    const baseline=new DrivingController({...f.driver.vehicle});baseline.resumeCruise();
    for(let i=0;i<1200;i++){f.driver.update(f.run('manualInput()'),1/60);baseline.update({},1/60);}
    assert.deepEqual({...f.driver.vehicle},baseline.vehicle);assert.equal(f.driver.mode,DRIVE_MODE.AUTO_CRUISE);
    assert.ok(Math.hypot(f.driver.vehicle.x-before.x,f.driver.vehicle.z-before.z)>1);assert.equal(f.driver.error,null);
  }
});
test('exit exploration: closes open content and delayed close events cannot overwrite welcome state',()=>{
  const f=fixture();f.$('#start-button').click();f.driver.takeControl();
  Object.assign(f.driver.vehicle,{x:-12,z:-7.7});assert.ok(f.driver.openLocation('about'));
  f.$('#journal').showModal();f.$('#photo-dialog').showModal();f.$('#journal-content').textContent='内容';
  f.run('exitExploring()');f.flushEvents();assertWelcome(f);
  assert.equal(f.$('#journal').open,false);assert.equal(f.$('#photo-dialog').open,false);
  assert.equal(f.$('#journal-content').textContent,'');assert.equal(f.$('#drive-status').textContent,'');
  assert.equal(f.driver.blocked.size,0);
});
test('exit exploration: closing location normally then using the footer exit works',()=>{
  const f=fixture();f.$('#start-button').click();f.driver.takeControl();
  Object.assign(f.driver.vehicle,{x:-12,z:-7.7});assert.ok(f.driver.openLocation('about'));
  f.$('#journal').showModal();f.$('#journal').close();f.flushEvents();
  assert.equal(f.driver.mode,DRIVE_MODE.EXPLORE);assert.equal(f.$('#exit-button').hidden,false);
  f.$('#exit-button').click();assertWelcome(f);
});
test('exit exploration: rapid repeated exit/restart keeps the original world and single RAF loop',()=>{
  const f=fixture(),world=f.world;
  for(let cycle=0;cycle<3;cycle++){
    f.$('#start-button').click();assert.equal(f.driver.mode,DRIVE_MODE.RETURNING_TO_START);
    assert.equal(f.$('#exit-button').hidden,false);
    f.$('#exit-button').click();f.flushTimers();assertWelcome(f);
    assert.equal(f.run('world'),world);
  }
  f.$('#start-button').click();
  for(let i=0;i<600&&f.driver.mode===DRIVE_MODE.RETURNING_TO_START;i++)f.driver.update({},1/60);
  assert.equal(f.driver.mode,DRIVE_MODE.EXPLORE);f.driver.update({throttle:1},1/60);assert.ok(f.driver.vehicle.speed>0);
  assert.equal(f.rafCount,0,'start and exit must not schedule animation loops');
  assert.equal((app.match(/requestAnimationFrame\(loop\)/g)||[]).length,2);
  assert.equal((app.match(/new IslandWorld\(/g)||[]).length,1);
  assert.ok(!app.includes('location.reload('));
});
