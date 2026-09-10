import {animatePanel} from './panel-motion.js';
import {
  boardArrows,
  boardCallouts,
  componentOverviewImage,
  extensionColumns,
  learningBoardImage
} from './learning-board-data.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[char]);

function arrowMarkup(arrow){
  const shape=`<line x1="${arrow.x1??arrow.x2}" y1="${arrow.y1??arrow.y2}" x2="${arrow.x2}" y2="${arrow.y2}" marker-end="url(#learning-arrowhead)"></line>`;
  return `${shape}<circle cx="${arrow.x2}" cy="${arrow.y2}" r="2.8"></circle>`;
}

function calloutMarkup(item){
  const anchor=item.anchor?` data-anchor="${item.anchor}"`:'';
  const association=item.association.map(escapeHtml).join('<br>');
  return `<button type="button" class="learning-callout ${item.position}"${anchor} aria-expanded="false"><span class="learning-callout-name">${escapeHtml(item.name)}</span><span class="learning-callout-detail"><span><span class="learning-callout-description">${escapeHtml(item.description)}</span><span class="learning-callout-association">关联：${association}</span></span></span></button>`;
}

function extensionMarkup(item){
  return `<details class="learning-extension"><summary>${escapeHtml(item.name)}</summary><div class="learning-extension-body"><div class="learning-extension-inner"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"><p><strong>${escapeHtml(item.name)}：</strong>${escapeHtml(item.description)}</p><small>${escapeHtml(item.port)} · 关联：${escapeHtml(item.association)}</small></div></div></details>`;
}

function hideBrokenImage(image){
  image.addEventListener('error',()=>{
    image.hidden=true;
    image.closest('.learning-extension-inner')?.classList.add('image-unavailable');
  },{once:true});
}

export function initLearningBoard(){
  const root=document.getElementById('learning-board');
  if(!root)return;
  const stage=root.querySelector('[data-learning-panel="board"]');
  const componentPanel=root.querySelector('[data-learning-panel="components"]');
  const extensionPanel=root.querySelector('[data-learning-panel="extensions"]');

  stage.innerHTML=`<img class="learning-board-photo" src="${learningBoardImage}" alt="STC-B学习板成品"><svg class="learning-lines" viewBox="0 0 1000 750" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="learning-arrowhead" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="currentColor"></path></marker></defs>${boardArrows.map(arrowMarkup).join('')}</svg>${boardCallouts.map(calloutMarkup).join('')}`;
  componentPanel.innerHTML=`<img src="${componentOverviewImage}" alt="学习板焊接元器件实物图">`;
  extensionPanel.innerHTML=extensionColumns.map(column=>`<div class="learning-extension-column">${column.map(extensionMarkup).join('')}</div>`).join('');

  stage.querySelector('.learning-board-photo').addEventListener('error',()=>{
    stage.classList.add('image-unavailable');
    stage.setAttribute('aria-label','学习板图片加载失败');
  },{once:true});
  componentPanel.querySelector('img').addEventListener('error',event=>{
    event.currentTarget.hidden=true;
    componentPanel.classList.add('image-unavailable');
  },{once:true});
  root.querySelectorAll('.learning-extension img').forEach(hideBrokenImage);

  const callouts=[...root.querySelectorAll('.learning-callout')];
  const arrowLabels=['c04','c03','c10','c15','c15','c14','c11','c07','c08','c09','cext','csm','c485','c06','c01','c05','c02','c12','c13'];
  const lines=[...stage.querySelectorAll('.learning-lines line')];
  function connectArrowLabels(){
    const bounds=stage.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    lines.forEach((line,index)=>{
      const key=arrowLabels[index];
      const box=stage.querySelector(`.learning-callout.${key}`).getBoundingClientRect();
      const cx=(box.left+box.width/2-bounds.left)*1000/bounds.width;
      const cy=(box.top+box.height/2-bounds.top)*750/bounds.height;
      const halfWidth=box.width*500/bounds.width,halfHeight=box.height*375/bounds.height;
      let x=cx,y=cy;
      if(key==='c15'){
        // One shared origin for the two straight infrared arrows.
        y+=halfHeight;
      }else{
        const dx=boardArrows[index].x2-cx,dy=boardArrows[index].y2-cy;
        const scale=Math.min(halfWidth/(Math.abs(dx)||1e-9),halfHeight/(Math.abs(dy)||1e-9));
        if(Number.isFinite(scale)){x+=dx*scale;y+=dy*scale;}
      }
      line.setAttribute('x1',String(x));line.setAttribute('y1',String(y));
    });
  }
  const arrowObserver=new ResizeObserver(connectArrowLabels);
  arrowObserver.observe(stage);
  callouts.forEach(callout=>arrowObserver.observe(callout));
  connectArrowLabels();
  const calloutAnimations=new WeakMap();
  function setCallout(callout,opening){
    if(callout.classList.contains('is-open')===opening)return;
    const start=callout.getBoundingClientRect();
    const oldStyle=getComputedStyle(callout);
    const startRadius=oldStyle.borderRadius;
    const oldAnimation=calloutAnimations.get(callout);
    if(oldAnimation){oldAnimation.onfinish=null;oldAnimation.cancel();}
    const detail=callout.querySelector('.learning-callout-detail');
    detail.style.removeProperty('width');
    detail.style.removeProperty('max-width');
    callout.classList.toggle('is-open',opening);
    callout.setAttribute('aria-expanded',String(opening));
    const end=callout.getBoundingClientRect();
    const endRadius=getComputedStyle(callout).borderRadius;
    // Keep the text at its final wrapping width while only the outer box resizes.
    if(opening){detail.style.width=`${detail.getBoundingClientRect().width}px`;detail.style.maxWidth='none';}
    const cleanup=()=>{detail.style.removeProperty('width');detail.style.removeProperty('max-width');calloutAnimations.delete(callout);};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){cleanup();return;}
    const animation=callout.animate([
      {width:`${start.width}px`,height:`${start.height}px`,maxWidth:'none',borderRadius:startRadius},
      {width:`${end.width}px`,height:`${end.height}px`,maxWidth:'none',borderRadius:endRadius}
    ],{duration:opening?280:220,easing:'cubic-bezier(.2,.8,.25,1)'});
    calloutAnimations.set(callout,animation);
    animation.onfinish=cleanup;
  }
  callouts.forEach(callout=>callout.addEventListener('click',event=>{
    event.stopPropagation();
    const opening=!callout.classList.contains('is-open');
    callouts.forEach(peer=>{if(peer!==callout)setCallout(peer,false);});
    setCallout(callout,opening);
  }));
  stage.addEventListener('click',()=>callouts.forEach(callout=>{
    setCallout(callout,false);
  }));

  const extensionCards=[...root.querySelectorAll('.learning-extension')];
  extensionCards.forEach(card=>{
    const summary=card.querySelector('summary');
    let closeTimer;
    summary.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(closeTimer);
      if(!card.classList.contains('is-open')){
        card.open=true;
        requestAnimationFrame(()=>requestAnimationFrame(()=>card.classList.add('is-open')));
      }else{
        card.classList.remove('is-open');
        closeTimer=setTimeout(()=>{card.open=false;},360);
      }
    });
  });

  const tabs=[...root.querySelectorAll('[data-learning-tab]')];
  const panels=[...root.querySelectorAll('[data-learning-panel]')];
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    if(tab.disabled)return;
    tabs.forEach(peer=>{
      const active=peer===tab;
      peer.classList.toggle('is-active',active);
      peer.setAttribute('aria-selected',String(active));
    });
    panels.forEach(panel=>{panel.hidden=panel.dataset.learningPanel!==tab.dataset.learningTab;});
  }));

  const fold=root.querySelector('#learning-fold');
  const panelWrap=root.querySelector('.learning-panels');
  fold.addEventListener('click',()=>{
    const collapsed=fold.getAttribute('aria-expanded')==='true';
    animatePanel(panelWrap,!collapsed);
    tabs.forEach(tab=>{tab.disabled=collapsed;});
    fold.textContent=collapsed?'展开':'收起';
    fold.setAttribute('aria-expanded',String(!collapsed));
  });
}
