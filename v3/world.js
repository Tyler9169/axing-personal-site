import * as T from './vendor/three.module.min.js';
import { STATIONS } from './driving.mjs';

const palette={sand:'#e7ddc5',edge:'#c9bca0',road:'#f3eddd',grass:'#b7c2a0',forest:'#49634b',sage:'#87966d',leaf:'#aab284',cream:'#f2ebdc',wood:'#a1815d',clay:'#b98b68',dark:'#34443b',water:'#d5e0d6'};
const materialCache=new Map();
const mat=(color)=>{if(!materialCache.has(color))materialCache.set(color,new T.MeshStandardMaterial({color,roughness:.86}));return materialCache.get(color);};
function mesh(geometry,color,parent,x=0,y=0,z=0){const m=new T.Mesh(geometry,typeof color==='string'?mat(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,w,h,d,color,x=0,y=0,z=0){return mesh(new T.BoxGeometry(w,h,d),color,parent,x,y,z);}
function cylinder(parent,r1,r2,h,color,x=0,y=0,z=0,segments=20){return mesh(new T.CylinderGeometry(r1,r2,h,segments),color,parent,x,y,z);}
function sphere(parent,r,color,x,y,z,scale=[1,1,1]){const m=mesh(new T.IcosahedronGeometry(r,1),color,parent,x,y,z);m.scale.set(...scale);return m;}
function roundShape(w,d,r){const s=new T.Shape(),x=-w/2,y=-d/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function slab(parent,w,d,r,h,color,x=0,y=0,z=0){const m=mesh(new T.ExtrudeGeometry(roundShape(w,d,r),{depth:h,bevelEnabled:false,curveSegments:12}),color,parent,x,y,z);m.rotation.x=-Math.PI/2;return m;}
function textureText(text,{width=1024,height=256,color='#40503d',background=null,size=100,font='Georgia',italic=false}={}){const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${italic?'italic ':''}${size}px ${font}`;ctx.fillText(text,width/2,height/2);const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;return tx;}
function textPlane(parent,text,w,h,x,y,z,options={}){const material=new T.MeshBasicMaterial({map:textureText(text,options),transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});return mesh(new T.PlaneGeometry(w,h),material,parent,x,y,z);}
function tree(parent,x,z,s=1,variant=0){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);parent.add(g);cylinder(g,.16,.25,2.3,palette.wood,0,1.15,0,7);const branch=cylinder(g,.07,.12,1.2,palette.wood,.25,2,0,6);branch.rotation.z=-.48;const colors=[palette.forest,palette.sage,palette.leaf];sphere(g,1.2,colors[variant%3],0,2.8,0,[1,1.25,.9]);sphere(g,.85,colors[(variant+1)%3],.65,2.65,.12,[1,1.1,.9]);sphere(g,.7,colors[(variant+2)%3],-.65,2.55,.15);cylinder(g,.64,.67,.12,'#a4ad89',0,.06,0);return g;}
function bench(parent,x,z,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;parent.add(g);for(const dx of [-1.05,1.05]){box(g,.13,.85,.7,palette.dark,dx,.42,0);box(g,.12,1.3,.12,palette.dark,dx,.65,-.35);}for(let i=0;i<4;i++)box(g,2.7,.13,.18,palette.wood,0,.87,-.3+i*.2);for(let i=0;i<3;i++)box(g,2.7,.16,.1,palette.wood,0,1.15+i*.2,-.4);}
function planter(parent,x,z){cylinder(parent,.45,.3,.65,palette.clay,x,.34,z);for(let i=0;i<5;i++){const a=i*2.4;const leaf=sphere(parent,.32,palette.sage,x+Math.cos(a)*.2,.95+Math.sin(i)*.1,z+Math.sin(a)*.2,[.35,1.7,.7]);leaf.rotation.z=Math.cos(a)*.5;}}
function arch(parent,x,z,color=palette.cream){box(parent,.45,2.4,.48,color,x-1.75,1.2,z);box(parent,.45,2.4,.48,color,x+1.75,1.2,z);const m=mesh(new T.TorusGeometry(1.75,.23,8,28,Math.PI),color,parent,x,2.4,z);m.rotation.z=0;return m;}

export class IslandWorld {
  constructor(host){
    this.host=host;this.scene=new T.Scene();this.scene.background=new T.Color(palette.water);
    this.scene.fog=new T.Fog(palette.water,95,155);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.setSize(host.clientWidth,host.clientHeight);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.03;
    this.renderer.domElement.setAttribute('aria-hidden','true');this.renderer.domElement.tabIndex=-1;host.append(this.renderer.domElement);
    this.camera=new T.OrthographicCamera(-40,40,30,-30,.1,220);
    this.cameraTarget=new T.Vector3(-7,0,2);this.orbit=.61;this.zoom=.95;this.userZoom=1;this.overview=false;this.started=false;
    this.pointer=new T.Vector2();this.raycaster=new T.Raycaster();this.pickables=[];this.rings=[];this.wheels=[];this.clouds=[];
    this.scene.add(new T.HemisphereLight('#fff9e9','#7a8c76',1.7));
    const sun=new T.DirectionalLight('#fff2d5',2.7);sun.position.set(-22,34,16);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-42,right:42,top:37,bottom:-37,near:1,far:100});sun.shadow.normalBias=.07;sun.shadow.bias=-.00018;sun.shadow.radius=4;this.scene.add(sun);
    this.makeIsland();this.makeStudio();this.makeGallery();this.makeGarden();this.makeCafe();this.makeDetails();this.makeCar();
    this.resize();this.render({x:0,z:14,angle:Math.PI,speed:0},0,1);
  }
  makeIsland(){
    mesh(new T.PlaneGeometry(260,260),palette.water,this.scene,0,-1.55,0).rotation.x=-Math.PI/2;
    slab(this.scene,58,44,8,1.55,palette.edge,0,-1.5,0);
    slab(this.scene,57.6,43.6,7.8,.12,palette.sand,0,.03,0);
    const outer=roundShape(51,37,9),inner=roundShape(42,28,6);outer.holes.push(new T.Path(inner.getPoints(48)));
    const road=mesh(new T.ShapeGeometry(outer,24),palette.road,this.scene,0,.172,0);road.rotation.x=-Math.PI/2;
    slab(this.scene,4.7,32,1.4,.02,palette.road,0,.173,0);slab(this.scene,47,4.8,1,.02,palette.road,0,.176,0);
    for(const x of [-12,12])slab(this.scene,4.6,7,1,.025,palette.road,x,.18,-3.1);
    for(const x of [-12,13])slab(this.scene,4.6,4,1,.025,palette.road,x,.18,12);
    slab(this.scene,13,10,3,.12,palette.grass,-13,.17,7.8);slab(this.scene,12,11,3,.12,'#c5c5a3',13,.17,7.5);
    for(let x=-18;x<=18;x+=3){box(this.scene,.75,.015,.075,'#cbbfa5',x,.205,0);box(this.scene,.75,.015,.075,'#cbbfa5',x,.205,16.2);}
    for(let z=-12;z<13;z+=3)box(this.scene,.075,.015,.7,'#cbbfa5',0,.204,z);
    const t=textPlane(this.scene,'AXING ISLAND',12,2.8,0,.22,-17.6,{size:88,color:'#8c9276',font:'Georgia'});t.rotation.x=-Math.PI/2;
    const tagline=textPlane(this.scene,'STAY CURIOUS.  STAY YOU.',10,1.3,0,.22,19.3,{size:60,font:'Arial',color:'#9a9f87'});tagline.rotation.x=-Math.PI/2;
    for(const s of STATIONS){const g=new T.Group();g.position.set(s.x,.22,s.z);this.scene.add(g);const ring=mesh(new T.RingGeometry(1.7,1.86,48),new T.MeshBasicMaterial({color:'#a39465',transparent:true,opacity:.8,side:T.DoubleSide}),g);ring.rotation.x=-Math.PI/2;const disc=mesh(new T.CircleGeometry(1.65,32),new T.MeshBasicMaterial({color:'#dedbc3',transparent:true,opacity:.5,side:T.DoubleSide}),g,0,.001,0);disc.rotation.x=-Math.PI/2;const num=textPlane(g,String(STATIONS.indexOf(s)+1),1.8,1.8,0,.02,0,{width:256,height:256,size:160,color:'#7d8262'});num.rotation.x=-Math.PI/2;this.rings.push({g,ring,disc,id:s.id});}
  }
  makeStudio(){
    const g=new T.Group();g.position.set(-12,0,-9);this.scene.add(g);this.mark(g,'about');
    slab(g,12.5,9.5,.4,.22,palette.cream,0,.14,0);
    box(g,12.5,4.5,.4,palette.cream,0,2.45,-4.5);box(g,.4,3.4,9,palette.cream,-6,1.9,0);box(g,.4,3.4,9,palette.cream,6,1.9,0);
    box(g,12.9,.32,2.6,'#c4c2a6',0,4.85,-3.8);
    for(let x=-5.7;x<=6;x+=.9)box(g,.12,.19,8.8,'#b3ac8e',x,4.4,0);
    textPlane(g,'THE STUDIO',6.5,1.2,0,4.03,-4.25,{size:100,color:'#667655'});
    this.picture(g,'travel-01',3.15,4.1,.4,2.35,-4.2);
    box(g,3,.16,1.7,palette.wood,-3.8,1.5,1);for(const x of [-4.95,-2.65])box(g,.16,1.4,1.4,palette.dark,x,.8,1);
    const laptop=box(g,1.25,.85,.06,palette.dark,-3.8,2,1.1);laptop.rotation.x=-.2;box(g,1.3,.08,.9,palette.dark,-3.8,1.65,1.6);
    cylinder(g,.27,.2,.5,palette.cream,-4.65,1.84,1.4);box(g,1.1,.12,.7,'#9ba589',-2.5,1.7,.85);
    bench(g,3.5,1.6,Math.PI/2);planter(g,-4.7,-3.5);planter(g,5,3.3);
    textPlane(g,'a.',2.2,2.2,4,2.5,-4.2,{width:512,height:512,size:310,italic:true,color:'#9aa185'});
    arch(g,0,4.45,'#ded8c4');
  }
  makeGallery(){
    const g=new T.Group();g.position.set(12,0,-9);this.scene.add(g);this.mark(g,'work');
    slab(g,12.5,9.5,.4,.22,'#eadfcf',0,.14,0);
    box(g,12.5,4.8,.4,'#d5b99c',0,2.55,-4.5);box(g,.4,3.4,9,'#e3d1b7',-6,1.9,0);box(g,.4,3.4,9,'#e3d1b7',6,1.9,0);
    box(g,13,.28,2.7,'#bc9775',0,5.08,-3.85);textPlane(g,'IDEAS, MADE REAL.',8,1.1,0,4.4,-4.25,{size:92,color:'#604e3e'});
    this.picture(g,'work-01',1.5,3.25,-3.55,2.3,-4.22);this.picture(g,'work-03',1.5,3.25,-1.5,2.3,-4.22);this.picture(g,'work-06',4.5,2.65,2.3,2.6,-4.22);
    cylinder(g,1.05,1.05,.85,palette.cream,3.65,.8,1);const art=mesh(new T.TorusKnotGeometry(.65,.19,50,8),palette.clay,g,3.65,1.85,1);art.rotation.x=.6;art.rotation.y=.4;
    box(g,2.4,.65,1.1,'#b58b69',-3.4,.7,1.65);textPlane(g,'100万',2.1,.6,-3.4,1.08,2.22,{width:512,height:180,size:98,color:'#f5eee0',font:'Arial'});
    for(let i=0;i<3;i++){box(g,.09,2.6,.09,palette.dark,-5+i*5,3,-3.6);const lamp=box(g,.5,.18,.5,palette.dark,-5+i*5,4.2,-3.6);lamp.rotation.x=.25;}
    planter(g,5,3.4);arch(g,0,4.4,'#d5b595');
  }
  makeGarden(){
    const g=new T.Group();this.scene.add(g);this.mark(g,'life');
    tree(g,-17,7,1.3,1);tree(g,-10,7,1.1,0);tree(g,-7.2,11,.82,2);bench(g,-17,12);
    // A small photography installation among the trees.
    for(const [x,z,file,rot] of [[-15,4,'travel-02',.15],[-11.9,4.5,'travel-03',-.15]]){const f=new T.Group();f.position.set(x,0,z);f.rotation.y=rot;g.add(f);box(f,.13,3.6,.13,palette.wood,-.85,1.8,0);box(f,.13,3.6,.13,palette.wood,.85,1.8,0);this.picture(f,file,1.9,2.8,0,2.3,.1);}
    cylinder(g,1.1,1.1,.3,'#919f7b',-8,.48,4.2);cylinder(g,.7,.7,.12,palette.cream,-8,.7,4.2);
    // Bicycle: two wheels, a triangular frame, saddle and handlebars.
    const bike=new T.Group();bike.position.set(-17.8,.4,9.6);bike.rotation.y=.25;g.add(bike);
    for(const x of [-.8,.8]){mesh(new T.TorusGeometry(.52,.065,7,24),palette.dark,bike,x,.62,0);for(let a=0;a<Math.PI;a+=Math.PI/4){const spoke=box(bike,1,.015,.015,'#a3a99b',x,.62,0);spoke.rotation.z=a;}}
    const seg=(a,b)=>{const v=new T.Vector3().subVectors(b,a);const o=cylinder(bike,.045,.045,v.length(),palette.clay);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());};
    for(const [a,b] of [[[-.8,.62,0],[-.25,1.3,0]],[[-.25,1.3,0],[.25,.65,0]],[[.25,.65,0],[-.8,.62,0]],[[-.25,1.3,0],[.65,1.3,0]],[[.65,1.3,0],[.25,.65,0]],[[.65,1.3,0],[.8,.62,0]]])seg(new T.Vector3(...a),new T.Vector3(...b));
    box(bike,.35,.1,.2,palette.dark,-.25,1.42,0);box(bike,.12,.12,.5,palette.dark,.65,1.5,0);
    for(const p of [[-19,4],[-19.3,5],[-8.2,13.8]])planter(g,...p);
  }
  makeCafe(){
    const g=new T.Group();g.position.set(13,0,6);this.scene.add(g);this.mark(g,'connect');
    slab(g,8,5.1,.6,.2,'#eee3cf',0,.26,0);box(g,8,3.4,.35,'#d9c4a5',0,2,-2.1);box(g,.35,3.4,4.2,'#d9c4a5',-3.8,2,0);box(g,.35,3.4,4.2,'#d9c4a5',3.8,2,0);
    box(g,8.7,.35,5.2,palette.forest,0,3.85,0);for(let x=-4;x<=4;x+=.45){const slat=box(g,.22,.08,2.4,x%1<.5?'#f0e7d4':'#7f9272',x,3.55,2.2);slat.rotation.x=.14;}
    textPlane(g,'HELLO, STRANGER.',6,1,0,2.9,-1.85,{size:90,color:'#657251'});box(g,6.7,1.3,.9,'#ba9771',0,1.05,1.5);box(g,7,.15,1.3,palette.cream,0,1.8,1.5);
    cylinder(g,.25,.2,.45,palette.forest,-2,2.1,1.5);cylinder(g,.22,.17,.35,palette.clay,-1.25,2.07,1.55);box(g,.8,.06,.65,'#899976',1.7,1.9,1.5);planter(g,3.3,2.8);
    const mailbox=new T.Group();mailbox.position.set(6,0,3.3);g.add(mailbox);cylinder(mailbox,.12,.15,1.5,palette.wood,0,.9,0);box(mailbox,1.3,.9,.85,palette.clay,0,1.85,0);box(mailbox,.76,.07,.02,palette.dark,0,1.92,.435);textPlane(mailbox,'a.',.6,.45,0,1.62,.45,{width:256,height:180,size:140,color:'#f4edde',italic:true});
    tree(this.scene,20,8,1.05,1);tree(this.scene,18,12,.78,2);
  }
  makeDetails(){
    for(const [x,z,s,c] of [[-24,-6,1.15,1],[-22,-13,.9,0],[-18,-17,.75,2],[23,-8,1,2],[24,2,1.1,0],[-25,3,.8,2],[-23,13,1,1],[6,-18,.7,0]])tree(this.scene,x,z,s,c);
    for(const x of [-22,22])for(const z of [-1,14]){cylinder(this.scene,.08,.09,2.5,palette.dark,x,1.35,z,8);cylinder(this.scene,.27,.18,.5,palette.cream,x,2.8,z,8);cylinder(this.scene,.33,.33,.08,palette.dark,x,3.07,z,8);}
    // Loose stones and reeds along the edge keep the model feeling handmade.
    for(let i=0;i<22;i++){const a=i*2.399,x=Math.cos(a)*27,z=Math.sin(a)*20;if(Math.abs(x)<20&&Math.abs(z)<16)continue;sphere(this.scene,.3+(i%3)*.13,['#b7b9a0','#d1cbb2','#aeb79b'][i%3],x,.25,z,[1.4,.6,1]);}
    for(const [x,z] of [[-35,-12],[37,15],[-10,30]]){const g=new T.Group();g.position.set(x,-1.45,z);this.scene.add(g);slab(g,5,3.8,1.8,.35,'#c3cbb9');sphere(g,1.1,'#acb89f',-.2,.45,0,[1.4,.5,1]);for(let i=0;i<3;i++){const pts=[];for(let j=0;j<30;j++){const a=j/29*Math.PI*1.2;pts.push(new T.Vector3(Math.cos(a)*(3.8+i),-.04,Math.sin(a)*(2.8+i)));}const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#e6ece2',transparent:true,opacity:.55}));g.add(line);}}
    // The central signpost points toward the four chapters.
    cylinder(this.scene,.1,.13,2.7,palette.wood,3.6,1.4,2.3,8);
    for(let i=0;i<3;i++){box(this.scene,2,.35,.1,i===1?'#758365':'#e9dfc8',3.6,2.6-i*.42,2.3).rotation.y=(i-1)*.15;}
    for(const [x,z] of [[-3,-4],[3,-4],[-3,7],[3,7]]){cylinder(this.scene,.22,.24,.55,'#b9b594',x,.4,z,8);}
  }
  picture(parent,file,w,h,x,y,z){box(parent,w+.16,h+.16,.13,palette.wood,x,y,z);const tx=new T.TextureLoader().load(`../assets/${file}.webp`);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());return mesh(new T.PlaneGeometry(w,h),new T.MeshStandardMaterial({map:tx,roughness:1}),parent,x,y,z+.085);}
  mark(group,id){group.userData.station=id;this.pickables.push(group);}
  makeCar(){
    this.car=new T.Group();this.scene.add(this.car);this.body=new T.Group();this.car.add(this.body);const g=this.body;
    box(g,1.55,.46,2.65,'#466449',0,.7,0);box(g,1.62,.15,2.58,'#6d855b',0,.88,0);box(g,1.44,.22,.85,'#657f55',0,1, .83);box(g,1.4,.32,.62,'#496a4d',0,1,-1);
    box(g,1.63,.18,.2,'#c4c4aa',0,.62,1.38);box(g,1.63,.18,.16,'#c4c4aa',0,.62,-1.37);
    for(const x of [-.52,.52]){box(g,.29,.24,.06,'#f0df9f',x,.89,1.36);box(g,.21,.13,.04,'#b57254',x,.78,-1.39);}
    box(g,.6,.2,.06,palette.dark,0,.75,1.4);
    const windshield=box(g,1.28,.62,.065,new T.MeshStandardMaterial({color:'#a7c7b9',transparent:true,opacity:.72,roughness:.18}),0,1.36,.42);windshield.rotation.x=-.16;
    for(const x of [-.67,.67]){const b=box(g,.07,.7,.07,palette.cream,x,1.33,.42);b.rotation.x=-.16;box(g,.15,.33,1.25,'#546f4e',x,1.09,-.32);}
    box(g,1.37,.07,.09,palette.cream,0,1.7,.36);
    for(const x of [-.35,.35]){box(g,.5,.25,.52,palette.clay,x,.95,-.35);box(g,.5,.54,.17,palette.clay,x,1.16,-.59);}
    // A tiny driver makes the vehicle feel like a character, not a cursor.
    cylinder(g,.16,.22,.35,palette.cream,-.35,1.28,-.22,10);sphere(g,.22,'#c79871',-.35,1.64,-.19);sphere(g,.225,palette.dark,-.35,1.73,-.23,[1,.6,1]);
    const wheel=mesh(new T.TorusGeometry(.17,.035,6,16),palette.dark,g,-.35,1.28,.04);wheel.rotation.x=-.7;
    box(g,1.02,.4,.53,'#b28e60',0,1.33,-1.01);for(const x of [-.28,.28])box(g,.07,.42,.55,'#6c7250',x,1.33,-1.01);
    for(const x of [-.82,.82])for(const z of [-.87,.87]){const turn=new T.Group();turn.position.set(x,.49,z);g.add(turn);const tire=cylinder(turn,.37,.37,.24,'#354039');tire.rotation.z=Math.PI/2;const hub=cylinder(turn,.18,.18,.255,'#d9d6bf');hub.rotation.z=Math.PI/2;this.wheels.push({turn,tire,hub,front:z>0});}
    this.carShadow=mesh(new T.CircleGeometry(1.25,32),new T.MeshBasicMaterial({color:'#5d6b4b',transparent:true,opacity:.11,depthWrite:false}),this.scene,0,.21,0);this.carShadow.rotation.x=-Math.PI/2;this.carShadow.scale.set(.77,1.35,1);
  }
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);const aspect=w/h;const height=w<600?142:aspect<1.2?100:54;this.camera.left=-height*aspect/2;this.camera.right=height*aspect/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();}
  pick(clientX,clientY){const r=this.host.getBoundingClientRect();this.pointer.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.pickables,true)[0];if(!hit)return null;let node=hit.object;while(node){if(node.userData.station)return node.userData.station;node=node.parent;}return null;}
  project(position){const v=new T.Vector3(...position).project(this.camera);return {x:(v.x*.5+.5)*this.host.clientWidth,y:(-.5*v.y+.5)*this.host.clientHeight,visible:v.z<1&&v.z>-1};}
  render(vehicle,time,dt,steer=0,reduced=false){
    this.car.position.set(vehicle.x,.06,vehicle.z);this.car.rotation.y=vehicle.angle;this.body.rotation.z=T.MathUtils.damp(this.body.rotation.z,-steer*Math.min(Math.abs(vehicle.speed),6)*.012,7,dt);
    this.body.position.y=reduced?0:Math.sin(time*8)*Math.min(Math.abs(vehicle.speed),1)*.012;
    for(const w of this.wheels){w.turn.rotation.y=w.front?steer*.3:0;w.tire.rotation.x+=vehicle.speed*dt*2.2;w.hub.rotation.x+=vehicle.speed*dt*2.2;}
    this.carShadow.position.set(vehicle.x,.21,vehicle.z);this.carShadow.rotation.z=-vehicle.angle;
    const mobile=this.host.clientWidth<700;
    const target=!this.started?new T.Vector3(mobile?0:-8,mobile?14:0,mobile?-1:1):this.overview?new T.Vector3(0,0,0):new T.Vector3(vehicle.x*.7,0,vehicle.z*.7-1);
    const factor=reduced?1:1-Math.exp(-dt*3);this.cameraTarget.lerp(target,factor);
    const wantedZoom=(!this.started?mobile?.85:.95:this.overview?.9:mobile?1.85:1.45)*this.userZoom;
    this.zoom=T.MathUtils.lerp(this.zoom,wantedZoom,factor);this.camera.zoom=this.zoom;this.camera.updateProjectionMatrix();
    this.camera.position.set(this.cameraTarget.x+Math.sin(this.orbit)*60,49+this.cameraTarget.y,this.cameraTarget.z+Math.cos(this.orbit)*60);this.camera.lookAt(this.cameraTarget);
    for(const r of this.rings){const near=Math.hypot(vehicle.x-r.g.position.x,vehicle.z-r.g.position.z)<3.6;r.ring.material.opacity=near?1:.55;r.ring.material.color.set(near?'#526f44':'#a39465');r.disc.material.opacity=near?.5:.18;if(!reduced)r.ring.scale.setScalar(1+Math.sin(time*1.7)*.025);}
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.renderer.dispose();this.renderer.domElement.remove();}
}
