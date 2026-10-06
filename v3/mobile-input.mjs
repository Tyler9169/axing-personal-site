export const PHONE_LAYOUT = '(max-width: 600px), (max-width: 950px) and (max-height: 500px)';

// Input adapter only: the existing driving controller remains the sole vehicle owner.
export function bindMobileInput(root, touch, canDrive, takeControl) {
  const buttons=[...root.querySelectorAll('[data-drive]')], pointers=new Map();
  const buttonAt=(node)=>{const b=node?.closest?.('[data-drive]');return buttons.includes(b)?b:null;};
  function publish(){
    touch.clear();
    for(const b of pointers.values())if(b)touch.add(b.dataset.drive);
    for(const b of buttons)b.classList.toggle('active',touch.has(b.dataset.drive));
  }
  function clear(){
    const ids=[...pointers.keys()];pointers.clear();publish();
    for(const id of ids)if(root.hasPointerCapture(id))root.releasePointerCapture(id);
  }
  function sync(){
    const enabled=canDrive();
    if(!enabled&&pointers.size)clear();
    for(const b of buttons)b.disabled=!enabled;
  }
  root.addEventListener('pointerdown',e=>{
    const b=buttonAt(e.target);
    if(!b||e.button!==0||!canDrive())return;
    e.preventDefault();takeControl();pointers.set(e.pointerId,b);
    root.setPointerCapture(e.pointerId);publish();
  });
  root.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    if(!canDrive()){clear();return;}
    e.preventDefault();
    pointers.set(e.pointerId,buttonAt(root.ownerDocument.elementFromPoint(e.clientX,e.clientY)));
    publish();
  });
  const release=e=>{if(pointers.delete(e.pointerId))publish();};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(event,release);
  root.addEventListener('contextmenu',e=>e.preventDefault());
  sync();return {clear,sync};
}
