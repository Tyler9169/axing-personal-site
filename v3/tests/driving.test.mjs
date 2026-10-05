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
