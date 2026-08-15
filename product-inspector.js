const GUIDE_ASSETS = {
  hinge: './assets/generated/hardware/references/hinge-heavy-v2.png',
  lock: './assets/generated/hardware/references/lock-smart-v2.png'
};

const TYPE_NAMES = { single: '单门', mother: '子母门', double: '对开门', sideLight: '单边边门', doubleSide: '双边边门' };
const INSPECTOR_PART_LABELS = {
  composition: '纹理细节',
  design: '主造型',
  frame: '特殊结构',
  transom: '气窗与玻璃',
  hardware: '五金配件',
  hinge: '合页',
  lock: '锁体'
};

export function compositionRule(context = {}) {
  const source = context.sourceType || context.type || 'double';
  const target = context.type || source;
  if (source === 'double' && target === 'mother') {
    return {
      mode: 'crop-left',
      title: '对开门改子母门：裁掉左扇外侧内容',
      text: '原图中缝保持不动，右侧主门继续使用原右半幅；左侧子门只保留靠近中缝的有效内容，外侧多余纹理被裁掉，绝不把整幅图横向压窄。'
    };
  }
  if (source === 'mother' && target === 'double') {
    return {
      mode: 'expand-left',
      title: '子母门改对开门：向左补充底纹',
      text: '原主门造型和中缝位置保持不动，左侧门扇向外增加同材质底纹。主造型、拉手和锁具维持原始物理尺寸，不跟随门扇宽度放大。'
    };
  }
  if (target === 'single') {
    return {
      mode: 'crop-left',
      title: '改单门：选取主门有效区域',
      text: '单门采用原产品主门扇的有效窗口。连续双门画面不会被压进一扇门，而是按主门侧裁切；无法独立成立的跨门造型会提示不适用。'
    };
  }
  return {
    mode: '',
    title: `${TYPE_NAMES[target] || '当前门型'}：保持原始纹理密度`,
    text: '门扇尺寸变化只改变纹理取景窗口：变宽显示更多，变窄裁掉边缘；变高显示更多上下底纹。底纹、主造型和五金始终保持原始比例。'
  };
}

function guideContent(part, context) {
  const rule = compositionRule(context);
  const product = context.productLabel || '当前产品';
  if (part === 'frame') return {
    eyebrow: 'FRAME & CASING', title: context.frameLabel || '门框与门套', image: context.texturePath,
    text: `${product} · ${context.frameLabel || '门框与门套'} · ${context.frameColor || '当前色板'}`,
    points: [`门洞尺寸 ${context.width || '—'} × ${context.height || '—'} mm`, `墙厚 ${context.wallThickness || '—'} mm · ${context.frameInstall || '居中安装'}`, `底槛 ${context.threshold || '标准配置'}`],
    action: '聚焦门框与门套', focus: 'frame'
  };
  if (part === 'transom') return {
    eyebrow: 'TRANSOM & GLASS', title: context.transomLabel || '气窗与玻璃', image: context.texturePath,
    text: `${product} · ${context.transomLabel || '无气窗'}${context.glassLabel ? ` · ${context.glassLabel}` : ''}`,
    points: [`门型 ${TYPE_NAMES[context.type] || context.type || '当前门型'}`, `主花件 ${context.transomMaterial || '—'} · ${context.transomProcess || '—'}`, `玻璃厚度 ${context.glassThickness || '—'}`],
    action: '聚焦气窗区域', focus: 'transom'
  };
  if (part === 'hardware') return {
    eyebrow: 'HARDWARE SYSTEM', title: context.hardwareLabel || '五金配件', image: context.lockImage || GUIDE_ASSETS.lock,
    text: `${product} · ${context.hardwareLabel || '锁具、执手、合页与密封条'}`,
    points: [`锁具 ${context.lockLabel || '—'}`, `执手 ${context.handleLabel || '—'}`, `合页 ${context.hingeLabel || '—'} · 密封条 ${context.sealLabel || 'EPDM'}`],
    action: '聚焦五金细节', focus: 'hardware'
  };
  if (part === 'composition') return {
    eyebrow: 'TEXTURE COMPOSITION', title: rule.title, image: context.texturePath,
    text: rule.text, mode: rule.mode,
    points: ['底纹按物理密度取景，不进行非等比拉伸', '主造型使用独立图层，位置和大小不受门洞尺寸牵连', '左右合纹以中缝为安装基准，门型变化从外侧裁切或补纹'],
    action: '查看正面裁切结果', focus: 'surface'
  };
  if (part === 'design') return {
    eyebrow: 'MAIN DESIGN', title: `${product} · ${context.designLabel || '主造型'}`, image: context.texturePath,
    text: context.designNote || '主造型从金属底纹中独立分层，可单独调整上下、左右和等比大小，不改变底纹颗粒、门框或五金安装基准。',
    points: ['跨双门图案作为一幅完整画面同步编辑', '子母门只裁切子门外侧，不挤压主门造型', '带灯拉手属于独立五金层，不烘焙进主造型'],
    action: '聚焦主造型', focus: 'surface'
  };
  if (part === 'hinge') return {
    eyebrow: 'HINGE SYSTEM', title: context.hingeLabel || '门体合页系统', image: GUIDE_ASSETS.hinge,
    text: '合页安装在门扇转轴侧，闭门正视图默认隐藏；打开主门后才显示合页、门扇厚度和门框连接关系。门扇必须绕合页轴旋转，不能围绕门体中心旋转。',
    points: ['合页数量和位置按门高及门重布置', '开启方向改变时，合页侧与锁侧同步互换', '模型打开后可查看合页、门扇侧边和锁体侧面'],
    action: '打开主门查看合页', focus: 'hinge'
  };
  return {
    eyebrow: 'LOCK & HARDWARE', title: context.lockLabel || '锁体与外部五金', image: context.lockImage || GUIDE_ASSETS.lock,
    text: '锁体安装高度采用固定毫米基准，不随门高缩放。对开门的锁具归属由开启方向决定；长拉手、隐形拉手与智能锁按产品工艺互斥或组合。',
    points: ['锁面、锁体侧板和锁舌使用一致的真实比例', '打开门后显示锁体侧板与金属锁舌', '五金缩放围绕自身中心，不拉动门扇主造型'],
    action: '聚焦锁具细节', focus: 'hardware'
  };
}

export function initProductInspector({ getContext, onInspect } = {}) {
  const stage = document.querySelector('#stage');
  const trigger = document.querySelector('#openProductInspector');
  if (!stage || typeof getContext !== 'function') return { update() {} };
  const shell = document.createElement('div');
  shell.className = 'product-inspector-shell';
  shell.setAttribute('aria-hidden', 'true');
  shell.innerHTML = `
    <section class="product-inspector-panel" role="dialog" aria-modal="true" aria-label="产品解构说明">
      <header class="product-inspector-head"><div><small>YADILO PRODUCT DETAIL</small><h2>产品解构</h2></div><button class="product-inspector-close" type="button" aria-label="关闭产品解构">×</button></header>
      <div class="product-inspector-context" aria-live="polite"><span>当前部件</span><b data-inspector-current>纹理细节</b></div>
      <div class="product-inspector-scroll"><div class="product-inspector-media" data-part="composition"><img alt="产品部件大图" /><span class="product-inspector-crop"></span></div><div class="product-inspector-copy"><small></small><h3></h3><p></p><ul class="product-inspector-points"></ul><button class="product-inspector-action" type="button"></button></div></div>
    </section>`;
  stage.append(shell);
  let activePart = 'composition';
  const media = shell.querySelector('.product-inspector-media');
  const image = media.querySelector('img');
  const crop = media.querySelector('.product-inspector-crop');
  const copy = shell.querySelector('.product-inspector-copy');
  const action = shell.querySelector('.product-inspector-action');

  function render(part = activePart) {
    activePart = part;
    const content = guideContent(part, getContext());
    shell.querySelector('[data-inspector-current]').textContent = INSPECTOR_PART_LABELS[part] || INSPECTOR_PART_LABELS.composition;
    media.dataset.part = part;
    image.src = content.image || GUIDE_ASSETS.hinge;
    image.alt = content.title;
    crop.className = `product-inspector-crop ${content.mode || ''}`;
    crop.hidden = part !== 'composition';
    copy.querySelector('small').textContent = content.eyebrow;
    copy.querySelector('h3').textContent = content.title;
    copy.querySelector('p').textContent = content.text;
    copy.querySelector('ul').innerHTML = content.points.map((point) => `<li>${point}</li>`).join('');
    action.textContent = content.action;
    action.dataset.focus = content.focus;
  }

  function open(part = 'composition') {
    render(part);
    shell.classList.add('open');
    shell.setAttribute('aria-hidden', 'false');
  }
  function close() {
    shell.classList.remove('open');
    shell.setAttribute('aria-hidden', 'true');
  }
  window.addEventListener('yadilo:close-product-inspector', close);
  trigger?.addEventListener('click', () => open('composition'));
  document.querySelectorAll('[data-inspector-open]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    open(button.dataset.inspectorOpen || 'composition');
    onInspect?.(button.dataset.inspectorOpen || 'composition', { preview: true });
  }));
  document.querySelector('#compositionLogicNote')?.addEventListener('click', () => open('composition'));
  shell.querySelector('.product-inspector-close').addEventListener('click', close);
  shell.addEventListener('click', (event) => { if (event.target === shell) close(); });
  action.addEventListener('click', () => onInspect?.(activePart, { focus: action.dataset.focus }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  render();
  return {
    open,
    close,
    inspect: (part = 'composition', detail = {}) => {
      open(part);
      onInspect?.(part, detail);
    },
    update: () => { if (shell.classList.contains('open')) render(activePart); }
  };
}
