import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

// 图片懒加载 - 延迟加载非首屏背景图
const lazyImages = document.querySelectorAll('.image-entry, .image-villa, .image-system, .store-image');
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const computedStyle = window.getComputedStyle(el);
      const bgImage = computedStyle.backgroundImage;
      // 触发浏览器预加载背景图
      if (bgImage && bgImage !== 'none') {
        const url = bgImage.slice(5, -2);
        const img = new Image();
        img.src = url;
      }
      observer.unobserve(el);
    }
  });
}, { rootMargin: '100px' });

lazyImages.forEach(img => imageObserver.observe(img));

const TYPE_DATA=[
  {name:'单门',note:'现代平板',width:960,height:2200,minW:800,maxW:1200,minH:2000,maxH:2600,transom:0,layout:[['main',1]]},
  {name:'子母门',note:'X201B · 一体气窗',width:1200,height:2200,minW:1050,maxW:1600,minH:2100,maxH:2800,transom:1,layout:[['child',.34],['main',.66]]},
  {name:'对开门',note:'等宽双扇',width:1500,height:2200,minW:1300,maxW:2200,minH:2100,maxH:2800,transom:0,layout:[['passive',.5],['main',.5]]},
  {name:'单边边门',note:'边门 + 主门',width:1280,height:2200,minW:1200,maxW:1900,minH:2100,maxH:2800,transom:0,layout:[['sidelight',.27],['main',.73]]},
  {name:'双边边门',note:'双边门 + 双扇',width:1800,height:2400,minW:1600,maxW:2400,minH:2200,maxH:3000,transom:0,layout:[['sidelight',.18],['passive',.32],['main',.32],['sidelight',.18]]}
];
const FINISH_DATA=[
  {name:'K9GBF-B-X201B',note:'星空蓝 · 双框竖肋',thumb:'assets/thumb-x201b.jpg',asset:'assets/k9-material-x201b-v1.png',design:'x201b',mapScale:1.02,frameTone:'#11191e'},
  {name:'K9GBF-0102TA',note:'香槟灰平板 · 深色中梃',thumb:'assets/thumb-0102ta.jpg',asset:'assets/k9-material-0102ta-v2.png',design:'ta',mapScale:1.08,stripMm:170,frameTone:'#625d56'},
  {name:'K9GBF-0102TB',note:'岩灰平板 · 亮色中梃',thumb:'assets/thumb-0102tb.jpg',asset:'assets/k9-material-0102tb-v1.png',design:'tb',mapScale:1.1,stripMm:120,frameTone:'#282a29'},
  {name:'K9GBF-A32D',note:'油绿灰 · 四框线',thumb:'assets/thumb-a32d.jpg',asset:'assets/k9-material-a32d-v2.png',design:'a32d',mapScale:1.04,frameTone:'#697067'}
];
const LOCKS=[['曜石黑智能锁','指纹 / 密码 / NFC',2600],['静音机械锁','经典机械锁体',900],['极简隐藏锁','嵌入式拉手',3800]];
const FRAMES=[['极窄黑','哑光金属门框',0,'#17191a'],['香槟金','细腻拉丝门框',600,'#a88b66'],['同色门框','与门扇一体',800,'#55504b']];
const CASINGS=[['同色门套','外框同色收口',0],['极简窄套','4 mm 外沿',500],['加厚护墙套','14 mm 外沿',1200]];
const TRANSOMS=[['无气窗','完整门体',0],['有气窗','同框一体采光',1200]];
const TRANSOM_TYPES=[['同色纹理气窗','门扇同材一体',0],['长虹夹胶气窗','暗色夹胶采光',900],['金属格栅气窗','同色格栅半透',1200]];
const GROUPS=[
  {key:'type',title:'门型',note:'Door structure',kind:'type',options:TYPE_DATA.map((v,i)=>[v.name,v.note,1800+i*400])},
  {key:'finish',title:'门扇款式',note:'K9GBF 官网参考款',kind:'finish',options:FINISH_DATA.map((v,i)=>[v.name,v.note,i*900])},
  {key:'transom',title:'气窗',note:'Integrated transom',options:TRANSOMS},
  {key:'transomType',title:'气窗类型',note:'Glass type',conditional:true,options:TRANSOM_TYPES},
  {key:'lock',title:'门锁款式',note:'Hardware',options:LOCKS},
  {key:'frame',title:'门框',note:'Inner frame',options:FRAMES},
  {key:'casing',title:'门套',note:'Outer casing',options:CASINGS}
];
const typeDimensions=TYPE_DATA.map(({width,height})=>({width,height}));
const state={type:1,finish:0,transom:1,transomType:0,lock:0,frame:0,casing:0,width:1200,height:2200,viewAngle:0,viewPitch:0};
const optionRoot=document.querySelector('#optionGroups');
const $=selector=>document.querySelector(selector);
const esc=value=>String(value).replace(/'/g,"\\'");
const textureLoader=new THREE.TextureLoader();
const textureCache=new Map();
let three;

function renderOptions(){
  optionRoot.innerHTML=GROUPS.map(group=>{
    const body=group.options.map((option,index)=>{
      if(group.kind==='type')return `<button class="option type-preview type-${index}" data-key="${group.key}" data-index="${index}"><span>${option[0]}</span><small>${option[1]}</small></button>`;
      if(group.kind==='finish')return `<button class="option swatch finish-swatch" data-key="${group.key}" data-index="${index}" style="background-image:url('${esc(FINISH_DATA[index].thumb)}')"><span>${option[0]}</span><small>${option[1]}</small></button>`;
      return `<button class="option" data-key="${group.key}" data-index="${index}">${option[0]}<small>${option[1]}</small></button>`;
    }).join('');
    return `<section class="option-group ${group.conditional?'conditional-group':''}" data-group="${group.key}"><div class="option-label"><span>${group.title}</span><small>${group.note}</small></div><div class="option-options">${body}</div></section>`;
  }).join('');
}

function optionCost(group){
  if(group.key==='transomType'&&!state.transom)return 0;
  return Number(group.options[state[group.key]][2]||0);
}
function estimate(){
  const type=TYPE_DATA[state.type];
  return 8680+GROUPS.reduce((sum,group)=>sum+optionCost(group),0)+Math.max(0,state.width-type.width)*1.2+Math.max(0,state.height-type.height)*.8;
}
function activeFinish(){return FINISH_DATA[state.finish]}
function frameColor(){return state.frame===2?activeFinish().frameTone:FRAMES[state.frame][3]}
function casingColor(){return state.casing===0?frameColor():state.casing===1?'#202326':activeFinish().frameTone}
function isPaired(){return TYPE_DATA[state.type].layout.length>1}
function colorHex(value){return new THREE.Color(value)}
function getTexture(asset){
  if(!textureCache.has(asset)){
    const texture=textureLoader.load(asset,()=>renderThreeDoor(lastDimensions));
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=THREE.ClampToEdgeWrapping;
    texture.wrapT=THREE.ClampToEdgeWrapping;
    textureCache.set(asset,texture);
  }
  return textureCache.get(asset);
}
function makeTexture(base,range){
  const texture=base.clone();
  texture.needsUpdate=true;
  texture.offset.set(range.x,range.y);
  texture.repeat.set(range.w,range.h);
  return texture;
}
function mat(color,roughness=.72,metalness=.08){
  return new THREE.MeshStandardMaterial({color:colorHex(color),roughness,metalness});
}
function addBox(group,{x,y,z=0,w,h,d,color,material}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material||mat(color));
  mesh.position.set(x,y,z);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}
function clearGroup(group){
  while(group.children.length){
    const child=group.children.pop();
    child.geometry?.dispose();
    if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());
    else child.material?.dispose();
  }
}
function initThree(){
  if(three)return three;
  const stage=$('#doorStage');
  const mount=document.createElement('div');
  mount.id='threeDoorMount';
  stage.appendChild(mount);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(32,1,.1,20);
  camera.position.set(0,.12,6.4);
  scene.add(new THREE.AmbientLight(0xffffff,1.8));
  const key=new THREE.DirectionalLight(0xffffff,2.4);
  key.position.set(-2.2,3.4,4.5);
  key.castShadow=true;
  scene.add(key);
  const fill=new THREE.DirectionalLight(0xdde8ff,.85);
  fill.position.set(3,1.6,2.8);
  scene.add(fill);
  const root=new THREE.Group();
  scene.add(root);
  three={mount,renderer,scene,camera,root};
  return three;
}
let lastDimensions;
function paintThree(){
  if(!three)return;
  three.camera.position.set(state.viewAngle*.018,.08,6.35);
  three.camera.lookAt(0,0,0);
  three.root.rotation.y=THREE.MathUtils.degToRad(state.viewAngle);
  three.root.rotation.x=THREE.MathUtils.degToRad(-1.5+state.viewPitch);
  three.renderer.render(three.scene,three.camera);
}
function renderThreeDoor(dimensions){
  if(!dimensions)return;
  lastDimensions=dimensions;
  const {mount,renderer,camera,root}=initThree();
  const bounds=mount.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  renderer.setSize(bounds.width,bounds.height,false);
  camera.aspect=bounds.width/bounds.height;
  camera.updateProjectionMatrix();
  clearGroup(root);

  const type=TYPE_DATA[state.type],finish=activeFinish(),hasTransom=state.transom===1;
  const scale=1/1000,w=state.width*scale,h=state.height*scale;
  const frame=48*scale,casing=38*scale,depth=82*scale,leafDepth=54*scale;
  const transomH=dimensions.transomMm*scale,leafH=dimensions.leafHeightMm*scale;
  const innerW=w-frame*2,innerLeafH=leafH-frame*2;
  const frameMat=mat(frameColor(),.46,.42),casingMat=mat(casingColor(),.5,.32);
  const baseTexture=getTexture(finish.asset);
  const textureReady=!!baseTexture.image;
  const mapW=type.maxW*(finish.mapScale||1.04),mapH=type.maxH*(finish.mapScale||1.04);
  const mapRepeat={w:Math.min(.98,state.width/mapW),h:Math.min(.98,state.height/mapH)};
  const mapOffset={x:(1-mapRepeat.w)/2,y:(1-mapRepeat.h)/2};

  root.position.y=-.03;
  const fit=Math.min(1.34,Math.max(.72,2.72/h,2.52/w));
  root.scale.setScalar(fit);

  addBox(root,{x:0,y:0,z:-depth/2,w:w+casing*2,h:h+casing*2,d:depth,color:casingColor(),material:casingMat});
  addBox(root,{x:0,y:0,z:-depth/2+.01,w:w,h:h,d:depth+.01,color:frameColor(),material:frameMat});
  addBox(root,{x:0,y:0,z:depth*.04,w:w-frame*2,h:h-frame*2,d:8*scale,color:'#111'});
  addBox(root,{x:-w/2+frame/2,y:0,z:0,w:frame,h:h,d:depth,color:frameColor(),material:frameMat});
  addBox(root,{x:w/2-frame/2,y:0,z:0,w:frame,h:h,d:depth,color:frameColor(),material:frameMat});
  addBox(root,{x:0,y:h/2-frame/2,z:0,w:w,h:frame,d:depth,color:frameColor(),material:frameMat});
  addBox(root,{x:0,y:-h/2+frame/2,z:0,w:w,h:frame,d:depth,color:frameColor(),material:frameMat});

  if(hasTransom){
    const ty=h/2-frame-transomH/2;
    const transomTex=textureReady?makeTexture(baseTexture,{x:mapOffset.x,y:mapOffset.y+mapRepeat.h*.72,w:mapRepeat.w,h:mapRepeat.h*.16}):null;
    const tMat=new THREE.MeshStandardMaterial({map:transomTex,color:state.transomType===1?0x6c7777:0xffffff,roughness:.58,metalness:.02,transparent:state.transomType!==0,opacity:state.transomType===0?1:.88});
    addBox(root,{x:0,y:ty,z:leafDepth*.28,w:innerW,h:transomH-frame,d:leafDepth,material:tMat});
    addBox(root,{x:0,y:ty-transomH/2,z:leafDepth*.34,w:w-frame*2,h:frame,d:depth,color:frameColor(),material:frameMat});
    if(state.transomType===2){
      for(let i=-3;i<=3;i++)addBox(root,{x:i*innerW/7,y:ty,z:leafDepth*.6,w:8*scale,h:transomH-frame,d:16*scale,color:frameColor(),material:frameMat});
    }
  }

  let cursor=-innerW/2;
  type.layout.forEach(([role,share])=>{
    const lw=innerW*share;
    const cx=cursor+lw/2;
    const cy=-h/2+frame+innerLeafH/2;
    const tx0=mapOffset.x+(cursor+innerW/2)/innerW*mapRepeat.w;
    const tex=textureReady?makeTexture(baseTexture,{x:tx0,y:mapOffset.y,w:mapRepeat.w*share,h:mapRepeat.h*(leafH/state.height)}):null;
    const leafMat=new THREE.MeshStandardMaterial({map:tex,color:textureReady?0xffffff:colorHex(finish.frameTone),roughness:.68,metalness:.03});
    addBox(root,{x:cx,y:cy,z:leafDepth*.22,w:lw,h:innerLeafH,d:leafDepth,material:leafMat});
    addBox(root,{x:cursor,y:cy,z:leafDepth*.58,w:frame*.36,h:innerLeafH,d:20*scale,color:frameColor(),material:frameMat});
    addDoorDesign(root,finish.design,role,cx,cy,lw,innerLeafH,scale,frameMat);
    if(role==='main')addHardware(root,cx,cy,lw,innerLeafH,scale);
    cursor+=lw;
  });
  addBox(root,{x:innerW/2,y:-h/2+frame+innerLeafH/2,z:leafDepth*.58,w:frame*.36,h:innerLeafH,d:20*scale,color:frameColor(),material:frameMat});
  paintThree();
}
function addDoorDesign(root,design,role,cx,cy,w,h,scale,frameMat){
  const profile=12*scale,inset=(role==='child'?42:72)*scale;
  if(design==='x201b'){
    addBox(root,{x:cx,y:cy,z:70*scale,w:w-inset*2,h:h-inset*2,d:10*scale,color:'#142129',material:frameMat});
    addBox(root,{x:cx,y:cy,z:76*scale,w:w-inset*2-44*scale,h:h-inset*2-44*scale,d:8*scale,color:'#243842'});
  }
  if(design==='ta'||design==='tb'){
    const strip=Math.min(w*.22,(design==='ta'?170:120)*scale);
    const side=role==='main'?-1:1;
    addBox(root,{x:cx+side*(w/2-strip/2),y:cy,z:74*scale,w:strip,h:h,d:16*scale,color:design==='ta'?'#3b3936':'#b4ab9a'});
  }
  if(design==='a32d'){
    addBox(root,{x:cx,y:cy+h*.14,z:72*scale,w:w-inset*2,h:h*.48,d:profile,color:'#747b72'});
    addBox(root,{x:cx,y:cy-h*.28,z:72*scale,w:w-inset*2,h:h*.22,d:profile,color:'#747b72'});
  }
}
function addHardware(root,cx,cy,w,h,scale){
  const bottom=900*scale;
  const x=isPaired()?cx-w/2+80*scale:cx+w/2-92*scale;
  const y=cy-h/2+bottom+55*scale;
  if(state.lock===1){
    addBox(root,{x,y,z:95*scale,w:34*scale,h:90*scale,d:18*scale,color:'#252525'});
    addBox(root,{x:x-42*scale,y:y+18*scale,z:104*scale,w:72*scale,h:10*scale,d:16*scale,color:'#b9a889'});
  }else{
    addBox(root,{x,y,z:98*scale,w:44*scale,h:(state.lock===2?170:138)*scale,d:24*scale,color:'#111314'});
    addBox(root,{x,y:y-32*scale,z:114*scale,w:22*scale,h:58*scale,d:10*scale,color:'#34383a'});
  }
}
function leafMarkup(role,index,finish){
  const hardware=role==='main'?`<div class="door-hardware hardware-${state.lock} ${isPaired()?'meeting-side':''}" data-hotspot="lock"><i></i><b></b></div>`:'';
  const label=role==='sidelight'?'边门':role==='child'?'子门':role==='passive'?'副门':'主门';
  return `<div class="door-leaf leaf-${role}" data-role="${role}" aria-label="${label}"><div class="leaf-design design-${finish.design}"></div>${hardware}</div>`;
}
function renderAssembly(){
  const type=TYPE_DATA[state.type],finish=activeFinish(),hasTransom=state.transom===1;
  const sceneElement=$('#doorScene'),scene=sceneElement.getBoundingClientRect();
  const transomMm=hasTransom?Math.min(320,Math.round(state.height*.14)):0;
  const leafHeightMm=state.height-transomMm;
  const maxH=Math.max(440,Math.floor((scene.height-124)*.94));
  const maxW=Math.max(360,Math.floor((scene.width-118)*.78));
  // Keep a little headroom at the default size, so height changes grow from
  // the threshold instead of every door appearing at the same maximum height.
  const pxPerMm=Math.min(maxH/Math.max(state.height,2200),maxW/state.width,.42);
  const frameStroke=8;
  const outerW=Math.round(state.width*pxPerMm),outerH=Math.round(state.height*pxPerMm),transomH=Math.round(transomMm*pxPerMm);
  const frameH=outerH-frameStroke*2-transomH;
  const opening=$('#doorOpening');
  opening.className=`door-opening assembly type-${state.type} casing-${state.casing}${hasTransom?' has-transom':''}`;
  const hardwareBottom=Math.round(900*pxPerMm);
  // Each finish owns one maximum-size material canvas for this door type.
  // Resizing only changes the viewport over that canvas; it never rescales it.
  const mapScale=finish.mapScale||1.04;
  const mapWidthMm=Math.round(type.maxW*mapScale),mapHeightMm=Math.round(type.maxH*mapScale);
  const mapWidth=Math.round(mapWidthMm*pxPerMm),mapHeight=Math.round(mapHeightMm*pxPerMm);
  const finishSize=`${mapWidth}px ${mapHeight}px`;
  const profile=Math.max(2,Math.round(12*pxPerMm));
  const designInset=Math.max(12,Math.round(72*pxPerMm));
  const stripFull=Math.max(24,Math.round((finish.stripMm||140)*pxPerMm));
  opening.style.cssText=`--frame-stroke:${frameStroke}px;--frame-color:${frameColor()};--casing-color:${casingColor()};--finish-image:url('${finish.asset}');--finish-size:${finishSize};--finish-map-width:${mapWidth}px;--finish-map-height:${mapHeight}px;--map-width-mm:${mapWidthMm};--map-height-mm:${mapHeightMm};--px-per-mm:${pxPerMm};--profile:${profile}px;--profile-wide:${Math.round(profile*1.6)}px;--profile-gap:${Math.round(profile*3.8)}px;--design-inset:${designInset}px;--design-inset-small:${Math.round(designInset*.68)}px;--design-inset-child:${Math.round(designInset*.45)}px;--center-strip-full:${stripFull}px;--center-strip-half:${Math.round(stripFull/2)}px;--transom-inset:${Math.round(frameStroke*1.2)}px;--transom-inset-wide:${Math.round(frameStroke*1.6)}px;--hardware-bottom:${hardwareBottom}px;width:${outerW}px;height:${outerH}px;grid-template-rows:${hasTransom?`${transomH}px `:''}${frameH}px;`;
  const model=$('#doorModel');
  model.style.cssText=`--view-angle:${state.viewAngle}deg;--door-depth:28px;--frame-color:${frameColor()};--casing-color:${casingColor()};width:${outerW}px;height:${outerH}px;`;
  model.className=`door-model ${state.viewAngle<0?'view-left':state.viewAngle>0?'view-right':'view-front'}`;
  const textureLayer='<div class="surface-map"></div>';
  const transom=hasTransom?`<div class="integrated-transom transom-${state.transomType} design-${finish.design}" data-hotspot="transom"><div class="transom-map"></div><div class="transom-design"></div><div class="glass-veil"></div><div class="transom-bars"></div></div>`:'';
  const leaves=type.layout.map(([role],index)=>leafMarkup(role,index,finish)).join('');
  const columns=type.layout.map(([,share])=>`${share}fr`).join(' ');
  opening.innerHTML=`${transom}<div class="door-frame" style="grid-template-columns:${columns}">${textureLayer}${leaves}</div>`;
  const assembly=opening.getBoundingClientRect();
  const rulerBounds=$('.scene-sliders').getBoundingClientRect();
  sceneElement.style.setProperty('--door-left',`${assembly.left-rulerBounds.left}px`);
  sceneElement.style.setProperty('--door-top',`${assembly.top-rulerBounds.top}px`);
  sceneElement.style.setProperty('--door-width',`${assembly.width}px`);
  sceneElement.style.setProperty('--door-height',`${assembly.height}px`);
  $('#doorStage').style.setProperty('--assembly-left',`${assembly.left-scene.left}px`);
  $('#doorStage').style.setProperty('--assembly-bottom',`${scene.bottom-assembly.bottom}px`);
  $('#doorStage').style.setProperty('--assembly-right',`${scene.right-assembly.right}px`);
  return {transomMm,leafHeightMm,outerW,outerH};
}

function updateSelection(){
  optionRoot.querySelectorAll('.option').forEach(button=>button.classList.toggle('selected',Number(button.dataset.index)===state[button.dataset.key]));
  $('[data-group="transomType"]').classList.toggle('disabled',state.transom!==1);
  document.querySelectorAll('[data-view-angle]').forEach(button=>{
    const selected=Number(button.dataset.viewAngle)===state.viewAngle&&state.viewPitch===0;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}
function updateLabels(dimensions){
  const type=TYPE_DATA[state.type],finish=activeFinish(),hasTransom=state.transom===1,price=estimate();
  $('#doorWidth').min=type.minW; $('#doorWidth').max=type.maxW; $('#doorWidth').value=state.width;
  $('#doorHeight').min=type.minH; $('#doorHeight').max=type.maxH; $('#doorHeight').value=state.height;
  document.querySelectorAll('[data-dimension="width"]').forEach(el=>{el.min=type.minW;el.max=type.maxW;el.value=state.width});
  document.querySelectorAll('[data-dimension="height"]').forEach(el=>{el.min=type.minH;el.max=type.maxH;el.value=state.height});
  $('.dimension-hint').textContent=`${type.name}可定制范围：${type.minW}–${type.maxW} × ${type.minH}–${type.maxH} mm`;
  $('#widthRangeValue').textContent=`${state.width} mm`; $('#heightRangeValue').textContent=`${state.height} mm`;
  $('#dimensionWidth').textContent=`W ${state.width} mm`; $('#dimensionHeight').textContent=`H ${state.height} mm`;
  $('#previewName').textContent=`${finish.name} · ${type.name}${hasTransom?' · '+TRANSOM_TYPES[state.transomType][0]:''}`;
  $('#previewCode').textContent=`YD-K9-${String(state.finish+1).padStart(2,'0')}-${['S','CM','D','SL','DL'][state.type]}`;
  $('#previewPrice').textContent=`¥ ${Math.round(price).toLocaleString()}`;
  $('#configProgress').textContent=`${hasTransom?3:2} / 5`;
  $('#headerCount').textContent='1';
  $('#orderType').textContent=type.name; $('#orderTexture').textContent=finish.name;
  $('#orderTransom').textContent=hasTransom?TRANSOM_TYPES[state.transomType][0]:'无气窗';
  $('#orderLock').textContent=LOCKS[state.lock][0]; $('#orderFrame').textContent=`${FRAMES[state.frame][0]} / ${CASINGS[state.casing][0]}`;
  $('#orderSize').textContent=`${state.width} × ${state.height} mm`; $('#orderPrice').textContent=`¥ ${Math.round(price).toLocaleString()}`;
  $('#orderVisual').innerHTML=`<div class="mini-door type-${state.type}" style="--mini-image:url('${finish.asset}');--mini-frame:${frameColor()}"></div>`;
}
function update(){
  const type=TYPE_DATA[state.type];
  state.width=Math.min(type.maxW,Math.max(type.minW,Number(state.width)||type.width));
  state.height=Math.min(type.maxH,Math.max(type.minH,Number(state.height)||type.height));
  typeDimensions[state.type]={width:state.width,height:state.height};
  updateSelection();
  const dimensions=renderAssembly();
  updateLabels(dimensions);
  renderThreeDoor(dimensions);
  // The configurator is intentionally a fixed desktop canvas. Selecting a
  // control must never scroll the door under the fixed navigation bar.
  if(window.scrollY) window.scrollTo(0,0);
}

function focusGroup(key){
  const group=$(`[data-group="${key}"]`); if(!group)return;
  group.scrollIntoView({behavior:'smooth',block:'nearest'}); group.classList.add('hotspot-focus');
  setTimeout(()=>group.classList.remove('hotspot-focus'),1000);
}
function openOrder(){ $('#backdrop').classList.add('open'); $('#orderDrawer').classList.add('open') }
function closeOrder(){ $('#backdrop').classList.remove('open'); $('#orderDrawer').classList.remove('open') }

let pressTimer;
let dragView;
function cancelPress(){clearTimeout(pressTimer);pressTimer=undefined}
$('#doorScene').addEventListener('pointerdown',event=>{
  if(event.target.closest('.view-angle-control,.scene-sliders,input,button'))return;
  const key=event.target.closest('[data-hotspot]')?.dataset.hotspot;
  if(key)pressTimer=setTimeout(()=>focusGroup(key==='transom'?'transomType':'lock'),520);
  dragView={x:event.clientX,y:event.clientY,angle:state.viewAngle,pitch:state.viewPitch,moved:false};
  event.currentTarget.setPointerCapture?.(event.pointerId);
});
$('#doorScene').addEventListener('pointermove',event=>{
  if(!dragView)return;
  const dx=event.clientX-dragView.x,dy=event.clientY-dragView.y;
  if(Math.hypot(dx,dy)>4){dragView.moved=true;cancelPress()}
  if(!dragView.moved)return;
  state.viewAngle=Math.max(-75,Math.min(75,dragView.angle+dx*.28));
  state.viewPitch=Math.max(-18,Math.min(16,dragView.pitch-dy*.18));
  updateSelection();
  paintThree();
});
['pointerup','pointerleave','pointercancel'].forEach(name=>$('#doorScene').addEventListener(name,event=>{
  cancelPress();
  if(dragView)event.currentTarget.releasePointerCapture?.(event.pointerId);
  dragView=undefined;
}));

optionRoot.addEventListener('click',event=>{
  const option=event.target.closest('.option'); if(!option)return;
  const key=option.dataset.key,index=Number(option.dataset.index);
  if(key==='type'){
    typeDimensions[state.type]={width:state.width,height:state.height}; state.type=index;
    state.width=typeDimensions[index].width; state.height=typeDimensions[index].height;
    state.transom=TYPE_DATA[index].transom; state.transomType=0;
  }else state[key]=index;
  update();
});
['doorWidth','doorHeight'].forEach(id=>$("#"+id).addEventListener('input',event=>{state[id==='doorWidth'?'width':'height']=Number(event.target.value);update()}));
document.querySelectorAll('[data-dimension]').forEach(input=>input.addEventListener('input',event=>{state[event.target.dataset.dimension]=Number(event.target.value);update()}));
document.querySelectorAll('[data-view-angle]').forEach(button=>button.addEventListener('click',()=>{
  state.viewAngle=Math.max(-12,Math.min(12,Number(button.dataset.viewAngle)||0));
  state.viewPitch=0;
  update();
}));
document.addEventListener('click',event=>{
  if(event.target.matches('[data-open-order]'))openOrder();
  if(event.target.matches('[data-close-order],#backdrop'))closeOrder();
  if(event.target.matches('#submitOrder')){
    const name=$('#customerName').value.trim(),phone=$('#customerPhone').value.trim();
    $('#toast').textContent=name&&/^1\d{10}$/.test(phone)?'方案已提交，顾问会尽快与你联系':'请填写正确的称呼和手机号码';
    $('#toast').classList.add('show'); setTimeout(()=>$('#toast').classList.remove('show'),2400);
  }
});
addEventListener('resize',()=>requestAnimationFrame(update));
renderOptions(); update();
