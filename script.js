const photos = {
  'travel-01': { title: '窗边的一刻', label: 'ON THE ROAD', tag: '旅行', alt: '阿星坐在窗边，望向窗外', description: '慢下来，留一点时间给自己。' },
  'travel-02': { title: '窗边，城市与我', label: 'ON THE ROAD', tag: '旅行', alt: '阿星站在高层落地窗前，眺望城市', description: '瑰丽。换一个视角，看见不同的城市。' },
  'travel-03': { title: '走进澳门的日常', label: 'ON THE ROAD', tag: '澳门', alt: '阿星在澳门的窗边生活照', description: '旅行让我们看见世界，也看见自己。' },
  'sport-01': { title: '在坚持中，感受变化', label: 'KEEP MOVING', tag: '健身', alt: '阿星的健身训练记录', description: '把训练变成习惯，感受身体一点点的变化。' },
  'sport-02': { title: '换一种速度看风景', label: 'KEEP MOVING', tag: '骑行', alt: '骑行时拍下的公路自行车', description: '骑上车，出发就是一件好事。' },
  'sport-03': { title: '把热爱交给身体', label: 'KEEP MOVING', tag: 'Breaking', alt: '街舞 Breaking 的练习与交流现场', description: '音乐响起的时候，用身体表达。' },
  'hobby-01': { title: '围坐一桌的快乐', label: 'LITTLE JOYS', tag: '桌游', alt: '与朋友一起玩璀璨宝石桌游', description: '璀璨宝石。和朋友一起，把快乐留在桌面上。' },
  'hobby-02': { title: '快乐，有烟火气', label: 'LITTLE JOYS', tag: '美食', alt: '阿星喜欢的美式烧烤拼盘', description: '美式烧烤，我的最爱。' },
  'hobby-03': { title: '认真玩，也是一种热爱', label: 'LITTLE JOYS', tag: '游戏', alt: '王者荣耀游戏角色图片', description: '王者荣耀。享受策略，也享受配合。' },
};
const groups = { selected: ['travel-02','sport-03','hobby-01'], travel: ['travel-01','travel-02','travel-03'], sport: ['sport-01','sport-02','sport-03'], hobby: ['hobby-01','hobby-02','hobby-03'] };
const workPhotos = {
  'work-01': { title: '账号展示 · 01', description: '个人说明书中的账号记录。' },
  'work-02': { title: '账号展示 · 02', description: '个人说明书中的账号记录。' },
  'work-03': { title: 'AI 内容账号', description: 'AI 实战案例与内容创作记录。' },
  'work-04': { title: '运营数据 · 01', description: '过往账号运营数据截图。' },
  'work-05': { title: '运营数据 · 02', description: '过往账号运营数据截图。' },
  'work-06': { title: '视频表现数据', description: '过往视频内容的播放与互动记录。' },
};
let activeGroup = 'selected';
let lightboxItems = groups.selected;
let photoIndex = 0;
const gallery = document.querySelector('#life-gallery');
const tabs = [...document.querySelectorAll('[data-filter]')];
const photoDialog = document.querySelector('#photo-dialog');
const caseDialog = document.querySelector('#case-dialog');
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');

function setMenu(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  mobileNav.hidden = !open;
}
menuToggle.addEventListener('click', () => setMenu(menuToggle.getAttribute('aria-expanded') !== 'true'));
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
window.matchMedia('(min-width: 601px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) setMenu(false); });

function selectGroup(key) {
  activeGroup = key;
  for (const tab of tabs) {
    const selected = tab.dataset.filter === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  gallery.setAttribute('aria-labelledby', `tab-${key}`);
  gallery.replaceChildren(...groups[key].map((id, index) => {
    const photo = photos[id];
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'gallery-card'; card.dataset.photoId = id;
    card.setAttribute('aria-label', `放大照片：${photo.title}`);
    const frame = document.createElement('span'); frame.className = 'gallery-image';
    const img = document.createElement('img'); img.src = `assets/${id}.webp`; img.alt = photo.alt;
    const icon = document.createElement('span'); icon.className = 'image-expand'; icon.textContent = '↗'; icon.setAttribute('aria-hidden','true');
    frame.append(img, icon);
    const caption = document.createElement('span'); caption.className = 'gallery-caption';
    const text = document.createElement('span');
    const eyebrow = document.createElement('small'); eyebrow.textContent = `0${index+1} / ${photo.label}`;
    const title = document.createElement('strong'); title.textContent = photo.title; text.append(eyebrow, title);
    const tag = document.createElement('span'); tag.className = 'caption-tag'; tag.textContent = photo.tag;
    caption.append(text, tag); card.append(frame, caption); return card;
  }));
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectGroup(tab.dataset.filter));
  tab.addEventListener('keydown', event => {
    let target;
    if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = tabs.length - 1;
    if (target !== undefined) { event.preventDefault(); tabs[target].focus(); selectGroup(tabs[target].dataset.filter); }
  });
});

function syncScrollLock() { document.body.classList.toggle('modal-open', Boolean(document.querySelector('dialog[open]'))); }
function openDialog(dialog) { dialog.showModal(); syncScrollLock(); }
function updatePhoto() {
  const id = lightboxItems[photoIndex]; const item = photos[id] || workPhotos[id];
  const img = document.querySelector('#lightbox-image');
  img.src = `assets/${id}.webp`; img.alt = item.alt || item.title;
  document.querySelector('#photo-title').textContent = item.title;
  document.querySelector('#photo-description').textContent = item.description;
  document.querySelector('#photo-counter').textContent = `${String(photoIndex+1).padStart(2,'0')} / ${String(lightboxItems.length).padStart(2,'0')}`;
}
function openPhoto(id, items) { lightboxItems = items; photoIndex = items.indexOf(id); updatePhoto(); openDialog(photoDialog); }
function stepPhoto(amount) { photoIndex = (photoIndex+amount+lightboxItems.length) % lightboxItems.length; updatePhoto(); }
gallery.addEventListener('click', event => { const card = event.target.closest('[data-photo-id]'); if (card) openPhoto(card.dataset.photoId, groups[activeGroup]); });
document.querySelector('.photo-prev').addEventListener('click', () => stepPhoto(-1));
document.querySelector('.photo-next').addEventListener('click', () => stepPhoto(1));
photoDialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); stepPhoto(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); stepPhoto(-1); }
});
document.querySelectorAll('[data-case-open]').forEach(button => button.addEventListener('click', () => openDialog(caseDialog)));
document.querySelectorAll('[data-work-photo]').forEach(button => button.addEventListener('click', () => openPhoto(button.dataset.workPhoto, Object.keys(workPhotos))));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
[photoDialog,caseDialog].forEach(dialog => {
  dialog.addEventListener('close', syncScrollLock);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});

let toastTimer;
function toast(message) {
  const node = document.querySelector('#toast'); clearTimeout(toastTimer);
  node.textContent = message; node.classList.add('visible');
  toastTimer = setTimeout(() => node.classList.remove('visible'), 3200);
}
document.querySelector('.share-button').addEventListener('click', async () => {
  const url = window.location.href.split('#')[0];
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url); toast('网站链接已复制，很高兴被你分享。');
    } else if (navigator.share) {
      await navigator.share({ title: '阿星 · 个人网站', text: '在创作与生活之间，保持好奇。', url });
    } else {
      window.prompt('复制链接，分享这个小天地', url);
    }
  } catch (error) { if (error.name !== 'AbortError') window.prompt('复制链接，分享这个小天地', url); }
});
document.querySelectorAll('[data-copy-wechat]').forEach(button => button.addEventListener('click', async () => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText('alpha-deadpool');
      toast('微信号已复制：alpha-deadpool');
    } else { window.prompt('复制微信号，在微信中搜索添加', 'alpha-deadpool'); }
  } catch { window.prompt('复制微信号，在微信中搜索添加', 'alpha-deadpool'); }
}));
document.querySelector('#copyright-year').textContent = new Date().getFullYear();
