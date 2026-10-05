export const SPAWN = { x: 0, z: 14, angle: Math.PI, speed: 0 };
export const STATIONS = [
  { id: 'about', title: '关于我的小屋', short: '关于我', english: 'THE STUDIO', x: -12, z: -2, label: [-12, 6.3, -9], color: '#536f50' },
  { id: 'work', title: '创作展厅', short: '创作展厅', english: 'SELECTED WORK', x: 12, z: -2, label: [12, 6.3, -9], color: '#b78258' },
  { id: 'life', title: '生活花园', short: '生活花园', english: 'LIFE, UNSCRIPTED', x: -12, z: 12, label: [-13, 5, 7], color: '#718766' },
  { id: 'connect', title: '你好', short: '认识一下', english: 'SAY HELLO', x: 13, z: 12, label: [13, 5.7, 6], color: '#927151' },
];
export const OBSTACLES = [
  ...[-12,12].flatMap(x => [
    {x:x-6,z:-9,w:.55,d:9}, {x:x+6,z:-9,w:.55,d:9}, {x,z:-13.4,w:12,d:.55},
  ]),
  {x:-15.8,z:-8,w:2.8,d:1.7}, {x:15.8,z:-8,w:2.4,d:1.6},
  {x:13,z:5.4,w:7.7,d:3.9}, {x:10,z:8.7,w:2,d:1.6},
  {x:-17,z:7,w:1.4,d:1.4}, {x:-10,z:7,w:1.4,d:1.4},
  {x:-17,z:12,w:3.4,d:1},
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
