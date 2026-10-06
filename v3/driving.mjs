export const SPAWN = { x: 0, z: 14, angle: Math.PI, speed: 0 };
export const STATIONS = [
  { id: 'about', title: '关于我的小屋', short: '关于我', english: 'THE STUDIO', x: -12, z: -2, label: [-12, 6.3, -9], color: '#536f50' },
  { id: 'work', title: '创作展厅', short: '创作展厅', english: 'SELECTED WORK', x: 12, z: -2, label: [12, 6.3, -9], color: '#b78258' },
  { id: 'life', title: '生活花园', short: '生活花园', english: 'LIFE, UNSCRIPTED', x: -12, z: 12, label: [-13, 5, 7], color: '#718766' },
  { id: 'connect', title: '你好', short: '认识一下', english: 'SAY HELLO', x: 13, z: 12, label: [13, 5.7, 6], color: '#927151' },
];
// Structural boxes are shared by rendering and collision; positions are local to each building.
export const BUILDINGS = {
  about: {x:-12,z:-9,parts:[
    {x:0,z:-4.5,w:12.5,d:.4,h:4.5,y:2.45,color:'#f2ebdc'},
    ...[-6,6].map(x=>({x,z:0,w:.4,d:9,h:3.4,y:1.9,color:'#f2ebdc'})),
    ...[-1.75,1.75].map(x=>({x,z:4.45,w:.45,d:.48,h:2.4,y:1.2,color:'#ded8c4'})),
  ]},
  work: {x:12,z:-9,parts:[
    {x:0,z:-4.5,w:12.5,d:.4,h:4.8,y:2.55,color:'#d5b99c'},
    ...[-6,6].map(x=>({x,z:0,w:.4,d:9,h:3.4,y:1.9,color:'#e3d1b7'})),
    ...[-1.75,1.75].map(x=>({x,z:4.4,w:.45,d:.48,h:2.4,y:1.2,color:'#d5b595'})),
  ]},
  connect: {x:13,z:6,parts:[
    {x:0,z:-2.1,w:8,d:.35,h:3.4,y:2,color:'#d9c4a5'},
    ...[-3.8,3.8].map(x=>({x,z:0,w:.35,d:4.2,h:3.4,y:2,color:'#d9c4a5'})),
    {x:0,z:1.5,w:6.7,d:.9,h:1.3,y:1.05,color:'#ba9771'},
    {x:0,z:1.5,w:7,d:1.3,h:.15,y:1.8,color:'#f2ebdc'},
  ]},
};
export const OBSTACLES = [
  ...Object.values(BUILDINGS).flatMap(b=>b.parts.map(p=>({x:b.x+p.x,z:b.z+p.z,w:p.w,d:p.d}))),
  {x:-15.8,z:-8,w:3,d:1.7}, {x:8.6,z:-7.35,w:2.4,d:1.1},
  {x:15.65,z:-8,w:2.1,d:2.1},
  {x:-17,z:7,w:.5,d:.5}, {x:-10,z:7,w:.5,d:.5},
  {x:-17,z:11.975,w:2.7,d:1.05},
  {x:-8.5,z:-7.4,w:1.05,d:2.7},
  ...[[-24,-6],[-22,-13],[-18,-17],[23,-8],[24,2],[-25,3],[-23,13],[6,-18],[-7.2,11],[20,8],[18,12]].map(([x,z])=>({x,z,w:.5,d:.5})),
  ...[[-3,-4],[3,-4],[-3,7],[3,7],[3.6,2.3]].map(([x,z])=>({x,z,w:.3,d:.3})),
];
export function isFree(x,z,padding=.84) {
  // Rounded boundary matches the island's shoreline.
  const dx=Math.max(Math.abs(x)-22,0), dz=Math.max(Math.abs(z)-15,0);
  if (Math.abs(x)>27-padding || Math.abs(z)>20-padding || dx*dx+dz*dz>(5-padding)**2) return false;
  return !OBSTACLES.some(o=>Math.abs(x-o.x)<o.w/2+padding&&Math.abs(z-o.z)<o.d/2+padding);
}
export function moveVehicle(vehicle,input,dt) {
  dt=Math.min(Math.max(dt,0),.05);
  const oldSpeed=vehicle.speed;
  vehicle.speed += (input.throttle||0)*12*dt;
  vehicle.speed *= Math.exp(-(input.brake?13:input.throttle?1.1:3.4)*dt);
  vehicle.speed=Math.max(-4,Math.min(input.boost?10:7.4,vehicle.speed));
  if(Math.abs(vehicle.speed)<.018)vehicle.speed=0;
  vehicle.angle+=(input.steer||0)*1.85*dt*Math.min(Math.abs(vehicle.speed)/2.4,1)*Math.sign(vehicle.speed);
  const nx=vehicle.x+Math.sin(vehicle.angle)*vehicle.speed*dt;
  const nz=vehicle.z+Math.cos(vehicle.angle)*vehicle.speed*dt;
  let collision=false;
  if(isFree(nx,nz)){vehicle.x=nx;vehicle.z=nz;}
  else{vehicle.speed=-oldSpeed*.12;collision=true;}
  return collision;
}
export function angleDelta(target,current){return Math.atan2(Math.sin(target-current),Math.cos(target-current));}
export function findRoute(start,target) {
  const step=1.25, max=24;
  const key=(x,z)=>`${x},${z}`;
  function closest(p){
    let best=null,dist=Infinity;
    for(let x=-max;x<=max;x++)for(let z=-max;z<=max;z++){
      if(!isFree(x*step,z*step,1))continue;
      const d=(p.x-x*step)**2+(p.z-z*step)**2;
      if(d<dist){best={x,z};dist=d;}
    }
    return best;
  }
  const s=closest(start),goal=closest(target);if(!s||!goal)return [];
  const sk=key(s.x,s.z),gk=key(goal.x,goal.z),open=[{...s,g:0,f:0,k:sk}],parents=new Map(),cost=new Map([[sk,0]]),closed=new Set();
  while(open.length){
    open.sort((a,b)=>a.f-b.f);const n=open.shift();if(closed.has(n.k))continue;
    if(n.k===gk){
      const path=[{x:target.x,z:target.z}];let k=n.k;
      while(k){const [x,z]=k.split(',').map(Number);path.push({x:x*step,z:z*step});k=parents.get(k);}
      return path.reverse();
    }
    closed.add(n.k);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=n.x+dx,z=n.z+dz,k=key(x,z);if(closed.has(k)||Math.abs(x)>max||Math.abs(z)>max||!isFree(x*step,z*step,1))continue;
      if(dx&&dz&&(!isFree(x*step,n.z*step,1)||!isFree(n.x*step,z*step,1)))continue;
      const g=n.g+Math.hypot(dx,dz);if(g>=(cost.get(k)??Infinity))continue;
      cost.set(k,g);parents.set(k,n.k);open.push({x,z,k,g,f:g+Math.hypot(goal.x-x,goal.z-z)});
    }
  }
  return [];
}

export const DRIVE_MODE = Object.freeze({
  AUTO_CRUISE:'AUTO_CRUISE', RETURNING_TO_START:'RETURNING_TO_START',
  EXPLORE:'EXPLORE', LOCATION_OPEN:'LOCATION_OPEN',
});
// Room entries are inside the open front wall; outdoor entries sit on their actual plots.
export const LOCATION_AREAS = {
  about:{x:-12,z:-7.7,w:8.8,d:3.4}, work:{x:12,z:-7.7,w:8.8,d:3.4},
  life:{x:-12.5,z:10.5,w:6,d:3.4}, connect:{x:13,z:10,w:5,d:2.4},
};
export function insideLocation(vehicle,id,margin=0){
  const a=LOCATION_AREAS[id];
  return !!a&&Math.abs(vehicle.x-a.x)<=a.w/2+margin&&Math.abs(vehicle.z-a.z)<=a.d/2+margin;
}
export function detectArrival(vehicle,blocked,targetId=null) {
  for(const s of STATIONS){
    if(!insideLocation(vehicle,s.id,.5))blocked.delete(s.id);
    if(targetId!==null&&s.id!==targetId)continue;
    if(insideLocation(vehicle,s.id)&&isFree(vehicle.x,vehicle.z)&&!blocked.has(s.id)){
      blocked.add(s.id);return s;
    }
  }
  return null;
}
const CRUISE_STOPS=[{x:0,z:3},{x:3,z:0},{x:19,z:0},{x:22,z:3},{x:22,z:13},{x:19,z:16},{x:3,z:16},{x:0,z:13}];
const distance=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
export function clearSegment(a,b,padding=.84){
  const steps=Math.max(1,Math.ceil(distance(a,b)/.1));
  for(let i=0;i<=steps;i++){const p=mix(a,b,i/steps);if(!isFree(p.x,p.z,padding))return false;}
  return true;
}
// Preserve A* routing, remove redundant points, then round only collision-free corners.
export function planDrive(start,target){
  if(!isFree(target.x,target.z))return [];
  const raw=findRoute(start,target);if(!raw.length)return [];
  const points=[{x:start.x,z:start.z}];
  for(let i=0;i<raw.length;){
    let next=-1;
    for(let j=i;j<raw.length;j++){
      if(clearSegment(points.at(-1),raw[j],.9))next=j;
      else break;
    }
    // The initial A* grid cell may be across a wall: never jump to it.
    if(next<0){if(clearSegment(points.at(-1),raw[i]))next=i;else return [];}
    if(distance(points.at(-1),raw[next])>.001)points.push(raw[next]);
    i=next+1;
  }
  const rounded=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1];
    const radius=Math.min(1.1,distance(a,b)*.35,distance(b,c)*.35);
    const entry=mix(b,a,radius/distance(a,b)),exit=mix(b,c,radius/distance(b,c));
    const curve=[entry];
    for(let j=1;j<=12;j++){const t=j/12;curve.push(mix(mix(entry,b,t),mix(b,exit,t),t));}
    if(clearSegment(rounded.at(-1),entry)&&curve.every((p,j)=>!j||clearSegment(curve[j-1],p)))rounded.push(...curve);
    else rounded.push(b);
  }
  if(points.length>1)rounded.push(points.at(-1));
  return rounded.slice(1);
}

// One controller owns the existing vehicle; update is called only by the app's RAF.
export class DrivingController {
  constructor(vehicle){
    this.vehicle=vehicle;this.mode=DRIVE_MODE.AUTO_CRUISE;this.route=[];this.destination=null;
    this.blocked=new Set();this.location=null;this.cruiseIndex=0;this.cruiseLaps=0;this.error=null;
  }
  setRoute(target){
    this.route=planDrive(this.vehicle,target);this.destination=target;
    this.error=this.route.length||distance(this.vehicle,target)<.01?null:'无法找到安全路线';
    return !this.error;
  }
  startExploring(){
    if(this.mode===DRIVE_MODE.RETURNING_TO_START)return;
    this.mode=DRIVE_MODE.RETURNING_TO_START;this.location=null;this.vehicle.speed=0;
    this.setRoute(SPAWN);
  }
  goTo(id){
    if(this.mode!==DRIVE_MODE.EXPLORE)return false;
    const a=LOCATION_AREAS[id];if(!a)return false;
    return this.setRoute({x:a.x,z:a.z,id});
  }
  takeControl(){if(this.mode===DRIVE_MODE.EXPLORE){this.route=[];this.destination=null;}}
  openLocation(id){
    if(this.mode===DRIVE_MODE.LOCATION_OPEN)return this.location===id;
    if(this.mode!==DRIVE_MODE.EXPLORE||!insideLocation(this.vehicle,id)||this.blocked.has(id)||!isFree(this.vehicle.x,this.vehicle.z))return false;
    this.blocked.add(id);this.location=id;this.mode=DRIVE_MODE.LOCATION_OPEN;
    this.route=[];this.destination=null;this.vehicle.speed=0;return true;
  }
  closeLocation(){
    if(this.mode!==DRIVE_MODE.LOCATION_OPEN)return;
    this.mode=DRIVE_MODE.EXPLORE;this.location=null;this.vehicle.speed=0;
  }
  // Ready for a future exit-exploration entry point; no new UI or timer is created.
  resumeCruise(){
    this.mode=DRIVE_MODE.AUTO_CRUISE;this.location=null;this.route=[];this.destination=null;this.error=null;this.vehicle.speed=0;
    this.cruiseIndex=CRUISE_STOPS.reduce((best,p,i)=>distance(this.vehicle,p)<distance(this.vehicle,CRUISE_STOPS[best])?i:best,0);
  }
  extendCruise(){
    const start=this.route.at(-1)||this.vehicle,goal=CRUISE_STOPS[this.cruiseIndex];
    const next=planDrive(start,goal);
    if(!next.length&&distance(start,goal)>.01){this.error='自动巡航路线暂不可达';return;}
    this.route.push(...next);this.cruiseIndex=(this.cruiseIndex+1)%CRUISE_STOPS.length;
    if(this.cruiseIndex===0)this.cruiseLaps++;
  }
  followRoute(dt,cruising){
    const v=this.vehicle;
    while(this.route.length&&distance(v,this.route[0])<.0001)this.route.shift();
    if(!this.route.length){v.speed=0;return;}
    const target=this.route[0],dist=distance(v,target),desired=Math.atan2(target.x-v.x,target.z-v.z);
    const delta=angleDelta(desired,v.angle),turn=Math.max(-2.4*dt,Math.min(2.4*dt,delta));
    v.angle+=turn;
    const remaining=this.route.reduce((sum,p,i)=>sum+distance(i?this.route[i-1]:v,p),0);
    const wanted=Math.abs(delta)>1?0:Math.min(cruising?3.2:4.2,cruising?Infinity:Math.sqrt(8*remaining))*(1-Math.min(Math.abs(delta),1)*.65);
    v.speed+=Math.max(-7*dt,Math.min(3.5*dt,wanted-v.speed));v.speed=Math.max(0,v.speed);
    // A large initial heading difference turns in place; no positional jump or wall cutting.
    if(Math.abs(delta)>1){v.speed=0;return;}
    const travel=Math.min(dist,v.speed*dt),next=mix(v,target,travel/dist);
    if(!clearSegment(v,next)){v.speed=0;this.error='自动行驶已在障碍前暂停';return;}
    v.x=next.x;v.z=next.z;
    if(travel>=dist-.0001)this.route.shift();
  }
  update(input,dt,{paused=false}={}){
    dt=Math.min(Math.max(dt,0),.05);
    if(this.mode===DRIVE_MODE.LOCATION_OPEN){this.vehicle.speed=0;return null;}
    if(this.mode===DRIVE_MODE.AUTO_CRUISE){
      if(paused){this.vehicle.speed=0;return null;}
      if(this.route.length<16&&!this.error)this.extendCruise();
      this.followRoute(dt,true);return null;
    }
    if(this.mode===DRIVE_MODE.RETURNING_TO_START){
      this.followRoute(dt,false);
      if(!this.route.length&&!this.error&&distance(this.vehicle,SPAWN)<.01){
        const delta=angleDelta(SPAWN.angle,this.vehicle.angle);
        this.vehicle.angle+=Math.max(-2.4*dt,Math.min(2.4*dt,delta));
        if(Math.abs(delta)<.01){this.mode=DRIVE_MODE.EXPLORE;this.destination=null;this.vehicle.speed=0;}
      }
      return null;
    }
    if(input.throttle||input.steer||input.brake||input.boost)this.takeControl();
    const targetId=this.destination?.id??null;
    if(this.destination){this.followRoute(dt,false);if(!this.route.length){this.destination=null;this.vehicle.speed=0;}}
    else moveVehicle(this.vehicle,input,dt);
    const arrival=detectArrival(this.vehicle,this.blocked,targetId);
    if(arrival){this.location=arrival.id;this.mode=DRIVE_MODE.LOCATION_OPEN;this.route=[];this.destination=null;this.vehicle.speed=0;}
    return arrival;
  }
}
