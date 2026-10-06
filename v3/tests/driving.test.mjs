import test from 'node:test';
import assert from 'node:assert/strict';
import {SPAWN, STATIONS, OBSTACLES, isFree, moveVehicle, findRoute} from '../driving.mjs';

test('holding forward drives the car and releasing slows it to rest',()=>{
  const v={...SPAWN};for(let i=0;i<100;i++)moveVehicle(v,{throttle:1},1/60);
  assert.ok(v.z<SPAWN.z-5);assert.ok(v.speed>5);
  for(let i=0;i<180;i++)moveVehicle(v,{},1/60);
  assert.equal(v.speed,0);assert.ok(isFree(v.x,v.z));
});
test('steering changes heading only when the car is moving',()=>{
  const v={...SPAWN};moveVehicle(v,{steer:1},.05);assert.equal(v.angle,SPAWN.angle);
  for(let i=0;i<60;i++)moveVehicle(v,{throttle:1,steer:1},1/60);
  assert.ok(v.angle>SPAWN.angle+.4);assert.ok(v.x<0);
});
test('a held accelerator cannot drive through the back wall of a room',()=>{
  const v={x:-12,z:-8,angle:Math.PI,speed:0};let hit=false;
  for(let i=0;i<240;i++)hit=moveVehicle(v,{throttle:1},1/60)||hit;
  assert.ok(hit);assert.ok(v.z>-12.5);assert.ok(isFree(v.x,v.z));
});
test('island edge prevents leaving the ground and brake reduces motion',()=>{
  const v={x:0,z:18,angle:0,speed:7};for(let i=0;i<240;i++)moveVehicle(v,{throttle:1},1/60);
  assert.ok(v.z<20);assert.ok(isFree(v.x,v.z));
  const braking={...SPAWN,speed:7};for(let i=0;i<30;i++)moveVehicle(braking,{brake:true},1/60);
  assert.ok(braking.speed<.02);
});
test('every room is reachable from the start and every other room without crossing walls',()=>{
  for(const start of [SPAWN,...STATIONS])for(const target of STATIONS){
    const path=findRoute(start,target);assert.ok(path.length,`${start.id||'start'} → ${target.id}`);
    assert.deepEqual(path.at(-1),{x:target.x,z:target.z});
    for(let i=1;i<path.length;i++)for(let j=0;j<=10;j++){
      const a=path[i-1],b=path[i],t=j/10;
      assert.ok(isFree(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t),`route collides before ${target.id}`);
    }
  }
  for(const wall of OBSTACLES)assert.equal(isFree(wall.x,wall.z),false);
});

// Stage 2 only: node --test --test-name-pattern='stage 2' v3/tests/driving.test.mjs
import {DrivingController, DRIVE_MODE, LOCATION_AREAS, insideLocation, clearSegment} from '../driving.mjs';
import {readFileSync} from 'node:fs';
const controller=()=>new DrivingController({...SPAWN});
function tick(driver,input={},dt=1/60){
  const before={...driver.vehicle},mode=driver.mode;
  const arrival=driver.update(input,dt);
  assert.ok(isFree(driver.vehicle.x,driver.vehicle.z),`${mode}: ${JSON.stringify(driver.vehicle)}`);
  assert.ok(clearSegment(before,driver.vehicle),'swept movement crosses a wall');
  assert.ok(Math.hypot(driver.vehicle.x-before.x,driver.vehicle.z-before.z)<=10*dt+.001,'position jumped');
  assert.equal(driver.error,null);
  return arrival;
}
function finishReturn(driver){
  for(let i=0;i<180*60&&driver.mode===DRIVE_MODE.RETURNING_TO_START;i++){
    assert.equal(tick(driver),null);
  }
  assert.equal(driver.mode,DRIVE_MODE.EXPLORE);
  assert.ok(Math.hypot(driver.vehicle.x-SPAWN.x,driver.vehicle.z-SPAWN.z)<.01);
  assert.equal(driver.vehicle.speed,0);
}
test('stage 2 / 1: automatically cruises for multiple uninterrupted laps',()=>{
  const d=controller();let travelled=0;
  for(let i=0;i<240*60;i++){const p={...d.vehicle};tick(d);travelled+=Math.hypot(d.vehicle.x-p.x,d.vehicle.z-p.z);}
  assert.equal(d.mode,DRIVE_MODE.AUTO_CRUISE);assert.ok(d.cruiseLaps>=3);assert.ok(travelled>200);
});
test('stage 2 / 2: cruise stays collision-free at 30 and 60 fps and ignores manual input',()=>{
  for(const dt of [1/30,1/60]){
    const d=controller(),baseline=controller();
    for(let i=0;i<90/dt;i++){tick(d,{throttle:1,steer:1,brake:true},dt);baseline.update({},dt);}
    assert.deepEqual(d.vehicle,baseline.vehicle);
  }
});
test('stage 2 / 3: starting exploration cancels cruise and returns by default',()=>{
  const d=controller();for(let i=0;i<720;i++)tick(d);
  const position={...d.vehicle};d.startExploring();
  assert.equal(d.mode,DRIVE_MODE.RETURNING_TO_START);assert.equal(d.vehicle.x,position.x);assert.equal(d.vehicle.z,position.z);
  const route=d.route;assert.equal(d.goTo('work'),false);d.startExploring();assert.equal(d.route,route);
  finishReturn(d);
});
test('stage 2 / 4: returns from multiple cruise positions without teleporting or opening content',()=>{
  for(const frames of [0,180,540,1080,1800,2520]){
    const d=controller();for(let i=0;i<frames;i++)tick(d);d.startExploring();finishReturn(d);
    assert.equal(d.location,null);assert.equal(d.blocked.size,0);
  }
});
test('stage 2 / 5: manual driving works after return and cancels destination driving',()=>{
  const d=controller();d.startExploring();finishReturn(d);
  for(let i=0;i<60;i++)tick(d,{throttle:1});assert.ok(d.vehicle.z<SPAWN.z-2);
  assert.ok(d.goTo('about'));tick(d,{throttle:1});assert.equal(d.destination,null);assert.equal(d.route.length,0);
});
test('return takeover: input takes effect in the same frame and never resumes automatic return',()=>{
  for(const input of [{throttle:1},{throttle:-1},{steer:1},{steer:-1},{brake:true},{boost:true}]){
    const d=controller();Object.assign(d.vehicle,{x:0,z:4,angle:0});d.startExploring();
    for(let i=0;i<30;i++)tick(d);
    assert.ok(d.route.length);assert.equal(d.destination,SPAWN);
    const expected={...d.vehicle};
    d.followRoute=()=>assert.fail('automatic driving must not run after takeover');
    for(let i=0;i<120;i++){
      const current=i<30?input:{};
      moveVehicle(expected,current,1/60);d.update(current,1/60);
      assert.deepEqual(d.vehicle,expected);assert.equal(d.mode,DRIVE_MODE.EXPLORE);
      assert.equal(d.destination,null);assert.deepEqual(d.route,[]);
    }
  }
});
test('return takeover: takeControl cancels a paused return and final heading alignment without moving the car',()=>{
  for(const atSpawn of [false,true]){
    const d=controller();Object.assign(d.vehicle,{z:atSpawn?SPAWN.z:4,angle:0});d.startExploring();
    if(atSpawn){d.route=[];d.update({},1/60);assert.equal(d.mode,DRIVE_MODE.RETURNING_TO_START);}
    else d.error='自动行驶已在障碍前暂停';
    const before={...d.vehicle};d.takeControl();
    assert.equal(d.mode,DRIVE_MODE.EXPLORE);assert.equal(d.error,null);
    assert.equal(d.destination,null);assert.deepEqual(d.route,[]);assert.deepEqual(d.vehicle,before);
    d.update({},1/60);assert.deepEqual(d.vehicle,before);
  }
});
test('stage 2 / 6: each destination opens only inside its actual area and freezes the vehicle',()=>{
  for(const s of STATIONS){
    const d=controller();d.startExploring();finishReturn(d);assert.ok(d.goTo(s.id));
    let opens=0;
    for(let i=0;i<120*60&&d.mode!==DRIVE_MODE.LOCATION_OPEN;i++){
      const a=tick(d);if(a){opens++;assert.equal(a.id,s.id);assert.ok(insideLocation(d.vehicle,s.id));}
    }
    assert.equal(d.mode,DRIVE_MODE.LOCATION_OPEN,s.id);assert.equal(opens,1);
    const stopped={...d.vehicle};for(let i=0;i<60;i++)assert.equal(tick(d,{throttle:1}),null);assert.deepEqual(d.vehicle,stopped);
    const outside=controller();outside.mode=DRIVE_MODE.EXPLORE;Object.assign(outside.vehicle,{x:s.x,z:s.z});
    if(!insideLocation(outside.vehicle,s.id))assert.equal(outside.openLocation(s.id),false);
  }
});
test('stage 2 / 7: closing cannot reopen until the car leaves the area including its exit margin',()=>{
  for(const s of STATIONS){
    const d=controller();d.startExploring();finishReturn(d);d.goTo(s.id);
    for(let i=0;i<7200&&d.mode!==DRIVE_MODE.LOCATION_OPEN;i++)tick(d);
    assert.equal(d.mode,DRIVE_MODE.LOCATION_OPEN);d.closeLocation();
    for(let i=0;i<600;i++)assert.equal(tick(d),null);
    assert.equal(d.openLocation(s.id),false);
    // Return to spawn is a real collision-checked departure, not a timer reset.
    d.startExploring();finishReturn(d);tick(d);assert.equal(d.blocked.has(s.id),false);
    d.goTo(s.id);let arrival=null;
    for(let i=0;i<7200&&!arrival;i++)arrival=tick(d);
    assert.equal(arrival?.id,s.id);
  }
});
test('stage 2 / 8: resuming cruise keeps position and a single controller / animation loop',()=>{
  for(const s of STATIONS){
    const d=controller();d.startExploring();finishReturn(d);d.goTo(s.id);
    for(let i=0;i<7200&&d.mode!==DRIVE_MODE.LOCATION_OPEN;i++)tick(d);
    d.closeLocation();const before={...d.vehicle};d.resumeCruise();
    assert.equal(d.vehicle.x,before.x);assert.equal(d.vehicle.z,before.z);
    for(let i=0;i<3600;i++)tick(d,{throttle:1,steer:1});assert.equal(d.mode,DRIVE_MODE.AUTO_CRUISE);
  }
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.equal((app.match(/requestAnimationFrame\(loop\)/g)||[]).length,2,'one initial RAF and one self-schedule');
  assert.ok(!app.includes('setInterval('));assert.ok(!app.includes('sampleWelcomeDrive'));
  assert.equal((app.match(/driving\.update\(/g)||[]).length,1);
});

import vm from 'node:vm';
import {detectArrival} from '../driving.mjs';
test('stage 3B: four click targets follow existing navigation and open the matching chapter on arrival',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  for(const station of STATIONS){
    const d=controller();d.mode=DRIVE_MODE.EXPLORE;
    const nodes=new Map(),buttons=STATIONS.map(s=>({dataset:{go:s.id},addEventListener(_,fn){this.click=fn;}}));
    const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{setAttribute(){}});return nodes.get(selector);};
    const shown=[],visited=new Set();
    const context=vm.createContext({driving:d,vehicle:d.vehicle,STATIONS,DRIVE_MODE,world:{},contextLost:false,started:true,
      $,$$:()=>buttons,clearInput(){},toast(message){assert.fail(message);},visited,
      chapters:Object.fromEntries(STATIONS.map(s=>[s.id,()=>s.id])),updateProgress(){},showDialog(dialog){shown.push(dialog);}});
    vm.runInContext('let activeChapter=0;'+app.slice(app.indexOf('function openChapter('),app.indexOf('function start()'))+
      app.slice(app.indexOf('function go('),app.indexOf('function toggleView()'))+
      app.split('\n').find(line=>line.startsWith("$$('[data-go]')")),context);
    buttons.find(b=>b.dataset.go===station.id).click();
    assert.equal(d.destination.id,station.id);assert.ok(d.route.length);assert.equal(shown.length,0);
    let arrival=null;
    for(let i=0;i<7200&&!arrival;i++)arrival=tick(d);
    assert.equal(arrival?.id,station.id);assert.ok(insideLocation(d.vehicle,station.id));
    context.arrival=arrival;
    vm.runInContext(app.split('\n').find(line=>line.includes('if(arrival)openChapter(arrival.id)')),context);
    assert.equal(shown.length,1);assert.equal($('#journal-content').innerHTML,station.id);
    assert.ok(visited.has(station.id));assert.equal(d.mode,DRIVE_MODE.LOCATION_OPEN);
  }
});
test('stage 3B: crossing non-target areas preserves navigation and does not block or open them',()=>{
  for(const start of STATIONS)for(const target of STATIONS){
    if(start.id===target.id)continue;
    const d=controller();d.mode=DRIVE_MODE.EXPLORE;
    Object.assign(d.vehicle,LOCATION_AREAS[start.id]);assert.ok(d.goTo(target.id));
    const destination=d.destination;let arrival=null,crossingFrames=0;
    for(let i=0;i<7200&&!arrival;i++){
      arrival=tick(d);
      if(insideLocation(d.vehicle,start.id)){
        crossingFrames++;assert.equal(arrival,null);assert.equal(d.destination,destination);
        assert.ok(d.route.length);assert.equal(d.mode,DRIVE_MODE.EXPLORE);
        assert.equal(d.blocked.has(start.id),false);
      }
    }
    assert.ok(crossingFrames);assert.equal(arrival?.id,target.id);
  }
});
test('stage 3B: target filter survives route completion in the same frame',()=>{
  const d=controller();d.mode=DRIVE_MODE.EXPLORE;
  Object.assign(d.vehicle,LOCATION_AREAS.about);
  // An exhausted route must not turn this frame into unrestricted manual arrival detection.
  d.destination={...LOCATION_AREAS.work,id:'work'};d.route=[];
  assert.equal(d.update({},1/60),null);assert.equal(d.location,null);assert.equal(d.blocked.size,0);
});
test('stage 3B: manual exploration and same-frame manual cancellation allow all four locations',()=>{
  for(const station of STATIONS)for(const cancel of [false,true]){
    const d=controller();d.mode=DRIVE_MODE.EXPLORE;
    Object.assign(d.vehicle,LOCATION_AREAS[station.id]);
    if(cancel)assert.ok(d.goTo(STATIONS.find(s=>s.id!==station.id).id));
    assert.equal(d.update(cancel?{brake:true}:{},1/60)?.id,station.id);
    assert.equal(d.mode,DRIVE_MODE.LOCATION_OPEN);
  }
});
test('stage 3B: navigation preserves blocked hysteresis and releases other locations after departure',()=>{
  for(const station of STATIONS){
    const d=controller();d.mode=DRIVE_MODE.EXPLORE;
    Object.assign(d.vehicle,LOCATION_AREAS[station.id]);
    assert.equal(d.update({},1/60)?.id,station.id);d.closeLocation();
    assert.ok(d.goTo(station.id));assert.equal(d.update({},1/60),null);
    assert.ok(d.blocked.has(station.id));assert.equal(d.openLocation(station.id),false);
    const target=STATIONS.find(s=>s.id!==station.id);assert.ok(d.goTo(target.id));
    let arrival=null;
    for(let i=0;i<7200&&!arrival;i++){
      arrival=tick(d);
      assert.equal(d.blocked.has(station.id),insideLocation(d.vehicle,station.id,.5));
    }
    assert.equal(arrival?.id,target.id);d.closeLocation();assert.ok(d.goTo(station.id));
    arrival=null;for(let i=0;i<7200&&!arrival;i++)arrival=tick(d);
    assert.equal(arrival?.id,station.id);
  }
  const a=LOCATION_AREAS.about,blocked=new Set(['about']);
  assert.equal(detectArrival({x:a.x+a.w/2+.25,z:a.z},blocked,'work'),null);
  assert.ok(blocked.has('about'));
  detectArrival({x:a.x+a.w/2+.51,z:a.z},blocked,'work');assert.equal(blocked.has('about'),false);
});
