import { SPAWN, STATIONS, DrivingController, DRIVE_MODE, insideLocation } from './driving.mjs';
import { PHONE_LAYOUT, bindMobileInput } from './mobile-input.mjs';

const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
const vehicle={...SPAWN}, keys=new Set(), touch=new Set();
const driving=new DrivingController(vehicle);
const phoneLayout=matchMedia(PHONE_LAYOUT);
let mobileInput=null;
let world=null,started=false,nearby=null,lastTime=0,elapsed=0,frame=0,activeChapter=0,toastTimer,drag=null,lastPinch=0,contextLost=false;
let visited=new Set();try{visited=new Set(JSON.parse(localStorage.getItem('axing-island-visited')||'[]').filter(id=>STATIONS.some(s=>s.id===id)));}catch{}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let previewPaused=false,pendingDestination=null,welcomeTimer;
function updatePreviewToggle(){const b=$('#preview-toggle');b.textContent=previewPaused?'播放小车':'暂停小车';b.setAttribute('aria-pressed',String(previewPaused));}
$('#preview-toggle').addEventListener('click',()=>{previewPaused=!previewPaused;updatePreviewToggle();});
updatePreviewToggle();
const stationButtons=STATIONS.map(s=>{const b=document.createElement('button');b.className='place-label';b.dataset.go=s.id;b.setAttribute('aria-label',`前往${s.title}`);b.innerHTML=`<span><strong>${s.title}</strong><small>${s.english}</small></span>`;$('#world-labels').append(b);return b;});
const photoData={
  'travel-01':['窗边的一刻','ON THE ROAD','阿星坐在窗边，望向窗外'],
  'travel-02':['窗边，城市与我','ON THE ROAD','阿星站在落地窗前眺望城市'],
  'travel-03':['走进澳门的日常','ON THE ROAD','阿星在澳门窗边的生活照'],
  'sport-01':['在坚持中，感受变化','KEEP MOVING','阿星的健身训练记录'],
  'sport-02':['换一种速度看风景','KEEP MOVING','骑行时拍下的公路自行车'],
  'sport-03':['把热爱交给身体','KEEP MOVING','Breaking 练习与交流现场'],
  'hobby-01':['围坐一桌的快乐','LITTLE JOYS','与朋友一起玩璀璨宝石桌游'],
  'hobby-02':['快乐，有烟火气','LITTLE JOYS','美式烧烤拼盘'],
  'hobby-03':['认真玩，也是一种热爱','LITTLE JOYS','王者荣耀游戏角色图片'],
};
const groups={selected:['travel-02','sport-03','hobby-01'],travel:['travel-01','travel-02','travel-03'],sport:['sport-01','sport-02','sport-03'],hobby:['hobby-01','hobby-02','hobby-03']};
const workTitles=['账号展示 · 01','账号展示 · 02','AI 内容账号','运营数据 · 01','运营数据 · 02','视频表现数据'];
function galleryHTML(group='selected'){return groups[group].map(id=>{const [title,label,alt]=photoData[id];return `<button type="button" data-photo="${id}" aria-label="放大照片：${title}"><img src="../assets/${id}.webp" alt="${alt}" loading="lazy"><small>${label}</small><strong>${title}</strong></button>`;}).join('');}
const chapters={
about:()=>`<div class="journal-content"><div class="about-layout"><div><h2 id="journal-title">随和是底色，<br>好奇是<span>本能。</span></h2><p class="chapter-subtitle">A little about me.</p><div class="body-copy"><p>你好，我是阿星，叶昊霖。<br>你也可以叫我陀螺。</p><p>来自广州，毕业于广州应用科技学院，美术学专业。做过新媒体运营，从策划、剪辑到后期包装，喜欢把一个想法完整地做出来。</p><p>性格佛系随和，熟悉之后才会慢慢打开话匣子。喜欢逻辑，也喜欢没有标准答案的创作；享受投入的过程，也珍惜生活的留白。</p></div><div class="journal-tags"><span>ENTP / J</span><span>美术学背景</span><span>保持好奇</span></div></div><figure class="about-photo"><button data-photo="travel-01" aria-label="放大阿星的生活照片"><img src="../assets/travel-01.webp" alt="阿星坐在餐厅窗边的生活照片"></button><figcaption><span>日常里的某个瞬间</span><span>01 — A QUIET MOMENT</span></figcaption></figure></div><dl class="journal-facts"><div><dt>BASED IN</dt><dd>中国 · 广州</dd></div><div><dt>EDUCATION</dt><dd>广州应用科技学院</dd></div><div><dt>BACKGROUND</dt><dd>美术学 / 新媒体运营</dd></div></dl><section class="about-video" aria-labelledby="self-introduction-title"><h3 id="self-introduction-title">自我介绍</h3><video controls preload="metadata" playsinline aria-label="阿星的自我介绍视频"><source src="./assets/self-introduction.mp4" type="video/mp4">你的浏览器暂不支持播放此视频。</video></section></div>`,
work:()=>`<div class="journal-content"><div class="work-heading"><h2 id="journal-title">让想法被看见，<br>让内容<span>有回响。</span></h2><p>从创意到成片，从内容到运营。<br>用审美打磨表达，也用数据理解反馈。</p></div><div class="work-metrics"><div><strong>100<small>万</small></strong><p>B 站单条最高播放量</p></div><div><strong>4–5<small>万</small></strong><p>日常视频播放量</p></div><div><strong>3<small>个</small></strong><p>负责运营的账号</p></div><div><strong>1–2<small>天</small></strong><p>平均视频更新周期</p></div></div><p class="work-summary">独立完成视频策划、剪辑与后期包装，将 AI 实战案例与业务内容结合，用更有网感的表达，连接内容与观众。</p><div class="work-skills"><div><h3>01 / 策划与表达</h3><p>从脚本出发，找到内容的切入点，收集与制作素材。</p></div><div><h3>02 / 视觉与制作</h3><p>剪辑、包装，把想法变成完整作品，统一内容风格。</p></div><div><h3>03 / 运营与反馈</h3><p>持续更新多个账号，关注真实反馈，优化观看体验。</p></div></div><div class="work-screens">${workTitles.map((t,i)=>`<button data-photo="work-0${i+1}" aria-label="放大${t}"><img src="../assets/work-0${i+1}.webp" alt="${t}" loading="lazy"></button>`).join('')}</div><p class="source-note">点击截图查看大图。以上数据来自个人说明书中的过往工作记录，不代表当前账号表现。</p></div>`,
life:()=>`<div class="journal-content"><div class="life-intro"><p class="chapter-subtitle">Beyond the screen.</p><h2 id="journal-title">生活本身，<br>就是<span>灵感。</span></h2><p class="body-copy">去看更远的风景，也认真过好眼前。<br>健身、骑行、Breaking；桌游、美食、王者。</p></div><div class="journal-tabs" role="group" aria-label="生活照片分类"><button data-filter="selected" aria-pressed="true">精选</button><button data-filter="travel" aria-pressed="false">在路上</button><button data-filter="sport" aria-pressed="false">动起来</button><button data-filter="hobby" aria-pressed="false">小热爱</button></div><div class="journal-gallery" id="journal-gallery">${galleryHTML()}</div><a class="life-film" href="https://my.feishu.cn/wiki/CaBywIQuNijyKak8I6Ncu6BZnD2" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▷</span><span><strong>人生副本</strong><small>前往飞书，从一段视频认识更鲜活的我。</small></span><span aria-hidden="true">↗</span></a></div>`,
connect:()=>`<div class="journal-content connect-panel"><h2 id="journal-title">新的故事，<br>从一句<span>你好</span>开始。</h2><p class="body-copy">很高兴，你开着小车来到这里。<br>聊创作，聊生活，或者只是打个招呼。</p><button class="wechat-copy" data-copy-wechat aria-label="复制微信号 alpha-deadpool"><span><small>微信 / WECHAT</small><strong>alpha-deadpool</strong></span><span aria-hidden="true">↗</span></button><p class="connect-note">点击复制微信号，在微信中搜索添加。</p><div class="connect-links"><a href="https://my.feishu.cn/wiki/CaBywIQuNijyKak8I6Ncu6BZnD2" target="_blank" rel="noopener noreferrer">我的个人说明书 ↗</a><button id="share-button">分享这座小岛 ↗</button><a href="../v2/">翻阅图文版 ↗</a></div><p class="signoff">Yours, Axing.</p></div>`,
};

function toast(message){clearTimeout(toastTimer);const node=$('#toast');node.textContent=message;node.classList.add('visible');toastTimer=setTimeout(()=>node.classList.remove('visible'),3300);}
function clearInput(){keys.clear();mobileInput?.clear();touch.clear();$$('[data-drive]').forEach(b=>b.classList.remove('active'));}
function isModalOpen(){return !!document.querySelector('dialog[open]');}
function showDialog(dialog){clearInput();vehicle.speed=0;dialog.showModal();}
function updateProgress(){
  $('#visited-count').textContent=visited.size;
  stationButtons.forEach((b,i)=>b.classList.toggle('visited',visited.has(STATIONS[i].id)));
  $$('.map-stop').forEach(b=>b.classList.toggle('visited',visited.has(b.dataset.go)));
  $$('.progress-dots i').forEach((dot,i)=>dot.classList.toggle('done',visited.has(STATIONS[i].id)));
  try{localStorage.setItem('axing-island-visited',JSON.stringify([...visited]));}catch{}
}
function openChapter(id){
  const s=STATIONS.find(s=>s.id===id);if(!s)return;
  if(world&&!contextLost&&!driving.openLocation(id))return;
  activeChapter=STATIONS.indexOf(s);vehicle.speed=0;
  $('#journal-eyebrow').textContent=`0${activeChapter+1} / ${s.english}`;
  $('#journal-content').innerHTML=chapters[id]();
  visited.add(id);updateProgress();$('#journal-counter').textContent=`发现 ${visited.size} / 4 · ${s.title}`;
  $('#journal-next').innerHTML=`前往${STATIONS[(activeChapter+1)%4].short} <span aria-hidden="true">→</span>`;
  $('#journal').scrollTop=0;showDialog($('#journal'));
  $('#journey-title').textContent=visited.size===4?'四个章节，都留下了你的足迹。':'随心开，慢慢逛。';
  $('#drive-status').textContent=`已到达${s.title}，正在阅读地点内容。`;
}
function start(){
  if(!world||started)return;
  started=true;clearInput();driving.startExploring();world.started=true;$('#preview-toggle').hidden=true;document.body.classList.add('exploring');
  $('#welcome').classList.add('leaving');welcomeTimer=setTimeout(()=>{$('#welcome').hidden=true;},500);
  $('#exit-button').hidden=false;
  $('#exploration-status').hidden=false;$('#mobile-controls').hidden=false;
  $('#journey-title').textContent='正在返回探索起点…';
  $('#drive-status').textContent='小车正在返回起点，到达后即可使用方向键探索。';
}
function exitExploring(){
  if(!world||!started)return;
  started=false;clearInput();pendingDestination=null;
  clearTimeout(welcomeTimer);clearTimeout(toastTimer);
  $$('dialog[open]').forEach(d=>d.close());
  driving.resumeCruise();driving.blocked.clear();
  nearby=null;activeChapter=0;drag=null;lastPinch=0;lastTime=0;
  previewPaused=false;updatePreviewToggle();
  world.started=false;world.overview=false;world.userZoom=1;world.orbit=.61;
  document.body.classList.remove('exploring');
  $('#welcome').hidden=false;$('#welcome').classList.remove('leaving');
  $('#exit-button').hidden=true;$('#preview-toggle').hidden=false;
  $('#exploration-status').hidden=true;$('#mobile-controls').hidden=true;$('#destination-prompt').hidden=true;
  $('#journey-title').textContent='随心开，慢慢逛。';
  $('#nearby-title').textContent='';$('#nearby-subtitle').textContent='';
  $('#journal-content').textContent='';
  $('#toast').classList.remove('visible');$('#toast').textContent='';
  $('#drive-status').textContent='';
  $('#view-button').setAttribute('aria-pressed','false');$('#view-button').textContent='全岛视角 ↗';
  world.resize();updateInterface();
  $('#start-button').focus({preventScroll:true});
}
function go(id){
  if(!world||contextLost){openChapter(id);return;}
  // Choosing a destination on the welcome screen still completes the return first.
  if(!started){start();pendingDestination=id;return;}
  if(driving.mode!==DRIVE_MODE.EXPLORE)return;
  clearInput();const s=STATIONS.find(s=>s.id===id);if(!s)return;
  if(!driving.goTo(id)){toast('这条路暂时走不通，先把小车开回路上吧。');return;}
  world.overview=false;$('#view-button').setAttribute('aria-pressed','false');$('#view-button').textContent='全岛视角 ↗';
  $('#journey-title').textContent=`正前往${s.title}`;$('#drive-status').textContent=`正在自动驾驶前往${s.title}。按方向键可接管。`;
}
function toggleView(){if(!world)return;world.overview=!world.overview;$('#view-button').setAttribute('aria-pressed',String(world.overview));$('#view-button').textContent=world.overview?'跟随小车 ↙':'全岛视角 ↗';}
function resetCar(){
  if(!world)return;if(!started){start();return;}
  if(driving.mode===DRIVE_MODE.RETURNING_TO_START)return;
  clearInput();pendingDestination=null;driving.startExploring();nearby=null;$('#destination-prompt').hidden=true;world.userZoom=1;
  $('#journey-title').textContent='正在返回探索起点…';$('#drive-status').textContent='小车正在沿安全路线返回起点。';
}

$('#start-button').addEventListener('click',start);$('#tour-button').addEventListener('click',()=>go('about'));
$('#exit-button').addEventListener('click',exitExploring);
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('#next-stop').addEventListener('click',()=>go((STATIONS.find(s=>!visited.has(s.id))||STATIONS[(activeChapter+1)%4]).id));
$('#enter-button').addEventListener('click',()=>{if(nearby)openChapter(nearby.id);});
$('#view-button').addEventListener('click',toggleView);$('#reset-button').addEventListener('click',resetCar);$('#home-button').addEventListener('click',resetCar);
$('#help-button').addEventListener('click',()=>showDialog($('#help-dialog')));
$('#reset-progress').addEventListener('click',()=>{visited.clear();activeChapter=0;updateProgress();$('#help-dialog').close();resetCar();});
$('#journal-next').addEventListener('click',()=>{$('#journal').close();driving.closeLocation();go(STATIONS[(activeChapter+1)%4].id);});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.close).close()));
$$('dialog').forEach(d=>{d.addEventListener('close',()=>{if(d.id==='journal')$$('#journal video').forEach(video=>video.pause());if(d.id==='journal'&&driving.mode===DRIVE_MODE.LOCATION_OPEN){driving.closeLocation();if(!driving.destination)$('#drive-status').textContent='已关闭地点内容，可继续驾驶探索。';}clearInput();lastTime=0;});d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});});
$('#journal-content').addEventListener('click',async e=>{
  const imageButton=e.target.closest('[data-photo]');
  if(imageButton){const id=imageButton.dataset.photo;const item=photoData[id];const title=item?item[0]:workTitles[Number(id.slice(-1))-1];$('#photo-title').textContent=title;$('#photo-image').src=`../assets/${id}.webp`;$('#photo-image').alt=item?item[2]:title;showDialog($('#photo-dialog'));return;}
  const filter=e.target.closest('[data-filter]');if(filter){$$('.journal-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));$('#journal-gallery').innerHTML=galleryHTML(filter.dataset.filter);return;}
  if(e.target.closest('[data-copy-wechat]')){try{await navigator.clipboard.writeText('alpha-deadpool');e.target.closest('[data-copy-wechat]').querySelector('small').textContent='已复制微信号 ✓';}catch{window.prompt('复制微信号','alpha-deadpool');}return;}
  if(e.target.closest('#share-button')){const url=location.href.split('#')[0];if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){e.target.closest('#share-button').textContent='发布后即可分享公开链接';return;}try{await navigator.clipboard.writeText(url);e.target.closest('#share-button').textContent='链接已复制 ✓';}catch{window.prompt('复制网址，分享这座小岛',url);}}
});

function takeManualControl(){
  const wasReturning=driving.mode===DRIVE_MODE.RETURNING_TO_START;
  const wasNavigating=wasReturning||(driving.mode===DRIVE_MODE.EXPLORE&&!!driving.destination);
  driving.takeControl();
  if(wasReturning)pendingDestination=null;
  if(wasNavigating&&!driving.destination){
    $('#journey-title').textContent='方向盘交给你了。';
    $('#drive-status').textContent='已取消自动带路。可手动驾驶，进入地点有效区域后自动打开内容。';
  }
}
const drivingKeys=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','shift']);
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||isModalOpen())return;
  const k=e.key.toLowerCase();
  const focusedControl=e.target.closest?.('button,a');
  if(drivingKeys.has(k)&&started&&!(k===' '&&focusedControl)){e.preventDefault();if(driving.mode===DRIVE_MODE.EXPLORE||driving.mode===DRIVE_MODE.RETURNING_TO_START){keys.add(k);takeManualControl();}}
  if(e.repeat)return;
  // Enter on a focused control keeps its native button behavior.
  if((k==='e'||(k==='enter'&&!focusedControl))&&nearby&&started){e.preventDefault();openChapter(nearby.id);}
  if(k==='m')toggleView();if(k==='r')resetCar();
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{clearInput();lastTime=0;});
mobileInput=bindMobileInput($('#mobile-controls'),touch,
  ()=>phoneLayout.matches&&(driving.mode===DRIVE_MODE.EXPLORE||driving.mode===DRIVE_MODE.RETURNING_TO_START)&&!isModalOpen()&&!contextLost,
  ()=>takeManualControl());
$('#mobile-controls').setAttribute('aria-label','按住前进或倒车，同时按左右键转向；松手停止输入');
phoneLayout.addEventListener('change',()=>{mobileInput.clear();mobileInput.sync();});

function manualInput(){return {throttle:(keys.has('w')||keys.has('arrowup')||touch.has('forward')?1:0)-(keys.has('s')||keys.has('arrowdown')||touch.has('reverse')?1:0),steer:(keys.has('a')||keys.has('arrowleft')||touch.has('left')?1:0)-(keys.has('d')||keys.has('arrowright')||touch.has('right')?1:0),brake:keys.has(' ')||touch.has('brake'),boost:keys.has('shift')};}
function updateInterface(){
  const w=$('#world').clientWidth,h=$('#world').clientHeight;
  mobileInput.sync();
  stationButtons.forEach((b,i)=>{
    const p=world.project(STATIONS[i].label);b.style.left=`${p.x}px`;b.style.top=`${p.y}px`;
    if(world.desktopWelcome){
      // Keep the existing visible buttons inside their dedicated scene viewport.
      b.style.left=`${Math.max(b.offsetWidth/2+8,Math.min(w-b.offsetWidth/2-8,p.x))}px`;
      b.style.top=`${Math.max(b.offsetHeight+8,Math.min(h-24,p.y))}px`;
      b.style.visibility=p.visible?'visible':'hidden';b.classList.toggle('nearby',nearby?.id===STATIONS[i].id);return;
    }
    const masked=!started&&(w<600?p.y<425||p.y>h-165:p.x<440&&p.y>150&&p.y<h-100);
    const fits=phoneLayout.matches?p.x>b.offsetWidth/2+4&&p.x<w-b.offsetWidth/2-4&&p.y>b.offsetHeight+4&&p.y<h-8:p.x>40&&p.x<w-40&&p.y>135&&p.y<h-70&&!masked;
    b.style.visibility=p.visible&&fits?'visible':'hidden';b.classList.toggle('nearby',nearby?.id===STATIONS[i].id);
  });
  const mx=90+vehicle.x*2.8,my=64+vehicle.z*2.6;$('#map-car').setAttribute('transform',`translate(${mx.toFixed(2)} ${my.toFixed(2)}) rotate(${(180-vehicle.angle*180/Math.PI).toFixed(1)})`);
  if(started){const s=driving.mode===DRIVE_MODE.EXPLORE?STATIONS.find(s=>insideLocation(vehicle,s.id)&&!driving.blocked.has(s.id))||null:null;if(s?.id!==nearby?.id){nearby=s;$('#destination-prompt').hidden=!s;if(s){$('#nearby-subtitle').textContent=s.english;$('#nearby-title').textContent=s.title;$('#drive-status').textContent=`已进入${s.title}，可以阅读地点内容。`;}}}
  $('#experience').dataset.x=vehicle.x.toFixed(2);$('#experience').dataset.z=vehicle.z.toFixed(2);$('#experience').dataset.speed=vehicle.speed.toFixed(2);$('#experience').dataset.mode=driving.mode;
}
function loop(timestamp){
  requestAnimationFrame(loop);if(!world||contextLost||document.hidden)return;
  if(isModalOpen()){lastTime=timestamp;return;}
  const dt=lastTime?Math.min((timestamp-lastTime)/1000,.05):.016;lastTime=timestamp;elapsed+=dt;
  const input=manualInput();
  const previousMode=driving.mode,previousError=driving.error;
  const arrival=driving.update(input,dt,{paused:previewPaused});
  if(previousMode===DRIVE_MODE.RETURNING_TO_START&&driving.mode===DRIVE_MODE.EXPLORE){
    clearInput();$('#journey-title').textContent='随心开，慢慢逛。';$('#drive-status').textContent='已回到起点。使用方向键驾驶，进入地点区域后即可阅读内容。';
    if(pendingDestination){const id=pendingDestination;pendingDestination=null;go(id);}
  }
  if(driving.error&&driving.error!==previousError)toast(driving.error);
  if(arrival)openChapter(arrival.id);
  world.render(vehicle,elapsed,dt,input.steer,reduced.matches);if(++frame%3===0)updateInterface();
}
function showFallback(message){contextLost=true;$('#welcome').hidden=true;$('#loading-note').hidden=true;$('#fallback').hidden=false;$('#world-labels').hidden=true;$('.island-map').hidden=true;$('#mobile-controls').hidden=true;$('.bottom-bar').hidden=true;$('#exploration-status').hidden=true;$('#destination-prompt').hidden=true;$('#experience').dataset.mode='fallback';console.warn(message);}

try {
  const {IslandWorld}=await import('./world.js');world=new IslandWorld($('#world'));
  $('#start-text').textContent='开始探索';$('#start-button').disabled=false;$('#tour-button').disabled=false;$('#loading-note').hidden=true;
  const canvas=world.renderer.domElement,pointers=new Map();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showFallback('WebGL context lost; reading navigation remains available.');});
  canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastPinch)world.userZoom=Math.max(.65,Math.min(1.7,world.userZoom*distance/lastPinch));lastPinch=distance;if(drag)drag.moved=true;return;}if(!drag)return;const dx=e.clientX-drag.x;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;if(drag.moved)world.orbit-=dx*.006;drag.x=e.clientX;drag.y=e.clientY;});
  canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(drag&&!drag.moved){const id=world.pick(e.clientX,e.clientY);if(id)go(id);}drag=null;lastPinch=0;});
  canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=null;lastPinch=0;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();world.userZoom=Math.max(.65,Math.min(1.7,world.userZoom*Math.exp(-e.deltaY*.001)));},{passive:false});
  window.addEventListener('resize',()=>world.resize());
  new ResizeObserver(()=>world.resize()).observe($('#world'));
  updateProgress();requestAnimationFrame(loop);
}catch(error){showFallback(error.message);}
