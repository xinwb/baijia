const QUICK_PRODUCT_OPTIONS = [
  { key: 'ruojian', label: '雅帝若简', style: '现代简约', line: '入户门', note: '现代极简 · 轻侘寂' },
  { key: 'yijian', label: '雅帝意简', style: '现代轻奢', line: '入户门', note: '木纹中轴 · 横向智能拉手' },
  { key: 'heya', label: '雅帝和雅', style: '现代简约', line: '入户门', note: '深古铜肌理 · 权杖灯带' },
  { key: 'ouya', label: '雅帝欧雅', style: '艺术装饰', line: '入户门', note: '门玻一体 · 锦檀纹' },
  { key: 'yuanyin', label: '雅帝圆隐', style: '现代艺术', line: '入户门', note: '轻奢自然意象' },
  { key: 'jiangchuan', label: '雅帝江川赋', style: '现代东方', line: '入户门', note: '自然意境 · 新中式轻奢' },
  { key: 'jinghong', label: '雅帝荆虹赋', style: '新中式', line: '入户门', note: '东方禅意 · 高端轻奢' },
  { key: 'qinghuafu', label: '雅帝清华赋', style: '宋式雅致', line: '入户门', note: '东方复古 · 新中式轻奢' },
  { key: 'qingya', label: '雅帝清雅', style: '现代简约', line: '入户门', note: '克制线条 · 轻奢质感' }
];

function mountPrivateConfiguratorTabs() {
  const panel = document.querySelector('.order-panel');
  if (!panel || panel.dataset.privateTabsMounted === 'true') return;
  if (panel.querySelectorAll(':scope > .config-accordion').length < 6) {
    window.setTimeout(mountPrivateConfiguratorTabs, 32);
    return;
  }
  panel.dataset.privateTabsMounted = 'true';
  panel.classList.add('private-configurator-compact');
  panel.classList.add('pdf-reference-layout');
  const intro = panel.querySelector('.panel-intro');
  const accordions = [...panel.querySelectorAll(':scope > .config-accordion')];
  const byFocus = Object.fromEntries(accordions.map((section) => [section.dataset.cameraFocus, section]));
  const productLabel = panel.querySelector('#productName')?.textContent?.trim() || '雅帝若简';

  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const quickProductKey = ({ jinghongfu: 'jinghong', jiangchuanfu: 'jiangchuan', qingya: 'qingya', qinghuafu: 'qinghuafu' }[new URLSearchParams(location.search).get('product')] || new URLSearchParams(location.search).get('product') || 'ruojian');
  const quickProduct = QUICK_PRODUCT_OPTIONS.find((item) => item.key === quickProductKey) || QUICK_PRODUCT_OPTIONS[0];
  const styleOptions = [...new Set(QUICK_PRODUCT_OPTIONS.map((item) => item.style))];
  const productOptions = (items) => items.map((item) => `<option value="${safeText(item.key)}">${safeText(item.label)}</option>`).join('');
  intro.innerHTML = `<div class="panel-brand-line"><span>K80 · PRIVATE CONFIGURATION</span><span>YADILO 2026</span></div><div class="panel-title-row"><div><p>私人定制</p><h1>${productLabel}</h1></div><span class="panel-status"><i></i> 实时预览</span></div><div class="guide-cmfp" aria-label="设计指导手册四项设计维度"><span><b>C</b> 色彩</span><span><b>M</b> 材料</span><span><b>F</b> 表面处理工艺</span><span><b>P</b> 图形纹理</span></div><div class="reference-context-switch pdf-context-switch" aria-label="当前产品路径"><button type="button" data-context-switch="style" aria-expanded="false"><i></i><span>${safeText(quickProduct.style)}</span></button><button type="button" data-context-switch="line" aria-expanded="false"><i></i><span>${safeText(quickProduct.line)}</span></button><button type="button" class="active" data-context-switch="product" aria-expanded="false"><i></i><span>${safeText(productLabel)}</span></button></div><section class="quick-product-picker" data-quick-picker hidden aria-label="顶部快速选品"><div class="quick-product-picker-head"><div><span>QUICK PRODUCT FINDER</span><b>快速找到产品</b></div><button type="button" data-quick-picker-close aria-label="关闭快速选品">×</button></div><div class="quick-product-picker-filters"><label><span>风格</span><select data-quick-filter="style"><option value="">全部风格</option>${styleOptions.map((value) => `<option value="${safeText(value)}">${safeText(value)}</option>`).join('')}</select></label><label><span>门类</span><select data-quick-filter="line"><option value="入户门">入户门 · K80</option></select></label><label><span>产品</span><select data-quick-filter="product">${productOptions(QUICK_PRODUCT_OPTIONS)}</select></label></div><div class="quick-product-results" data-quick-results></div></section>`;

  const tabBar = document.createElement('div');
  tabBar.className = 'config-tabs';
  tabBar.setAttribute('role', 'tablist');
  tabBar.setAttribute('aria-label', '私人定制配置分类');
  const tabDefinitions = [
    ['basic', '01', '基础信息'],
    ['frame', '02', '门框与门套'],
    ['transom', '03', '气窗'],
    ['hardware', '04', '五金配件']
  ];
  tabBar.innerHTML = tabDefinitions.map(([key, number, label], index) => `<button type="button" role="tab" class="config-tab${index === 0 ? ' active' : ''}" id="configTab-${key}" aria-selected="${index === 0}" aria-controls="configPanel-${key}" data-config-tab="${key}"><small>${number}</small><span>${label}</span></button>`).join('');
  intro.insertAdjacentElement('afterend', tabBar);

  const panels = {};
  ['basic', 'frame', 'transom', 'hardware'].forEach((key, index) => {
    const tabPanel = document.createElement('section');
    tabPanel.className = 'config-tab-panel';
    tabPanel.id = `configPanel-${key}`;
    tabPanel.dataset.configPanel = key;
    tabPanel.setAttribute('role', 'tabpanel');
    tabPanel.setAttribute('aria-labelledby', `configTab-${key}`);
    tabPanel.hidden = index !== 0;
    tabBar.insertAdjacentElement('afterend', tabPanel);
    panels[key] = tabPanel;
  });

  const panelHeaders = {
    basic: ['建立门体基础', '按 C·M·F·P 确认门型、门洞尺寸与正背面设计。'],
    frame: ['定义建筑收口', '门套、门框、墙面模块与底槛按结构拆解确认。'],
    transom: ['配置顶部气窗', '按图标选择气窗、玻璃、花件与对应工艺。'],
    hardware: ['完成五金配套', '锁具、执手、合页与密封条按配件结构逐级确认。']
  };
  Object.entries(panels).forEach(([key, tabPanel]) => {
    const [title, copy] = panelHeaders[key];
    tabPanel.innerHTML = `<header class="tab-panel-header"><span>${tabDefinitions.find((item) => item[0] === key)?.[1]}</span><div><h2>${title}</h2></div></header>`;
  });

  [byFocus.structure, byFocus.dimensions, byFocus.surface].filter(Boolean).forEach((section) => panels.basic.append(section));
  if (byFocus.frame) panels.frame.append(byFocus.frame);
  if (byFocus.transom) panels.transom.append(byFocus.transom);
  if (byFocus.hardware) panels.hardware.append(byFocus.hardware);

  const hingeHeading = [...(byFocus.structure?.querySelectorAll('.field-heading') || [])]
    .find((heading) => heading.textContent.includes('铰链'));
  const hingeChoices = hingeHeading?.nextElementSibling;
  const hardwareBody = byFocus.hardware?.querySelector('.accordion-body');
  if (hingeHeading && hingeChoices && hardwareBody) {
    hardwareBody.append(hingeHeading, hingeChoices);
  }

  const basicBody = byFocus.dimensions?.querySelector('.accordion-body');
  if (basicBody) {
    const notes = document.createElement('label');
    notes.className = 'config-notes-field';
    notes.innerHTML = '<span>特殊需求备注</span><textarea id="configurationNotes" rows="3" maxlength="300" placeholder="例如：门洞现场条件、开孔位置或特殊工艺要求"></textarea><small><b id="configurationNotesCount">0</b> / 300</small>';
    basicBody.append(notes);
    const textarea = notes.querySelector('textarea');
    const count = notes.querySelector('b');
    textarea.addEventListener('input', () => { count.textContent = String(textarea.value.length); });
  }

  if (hardwareBody) {
    const sealCard = document.createElement('section');
    sealCard.className = 'hardware-product-detail seal-detail';
    sealCard.innerHTML = '<div class="field-heading"><span>密封条</span><small>门板 / 五金 / 配件 BOM 分类</small></div><article class="seal-card"><img src="./assets/generated/hardware/references/epdm-seal-v2.png" alt="三元乙丙一体成型密封胶条示意图" /><div><b>三元乙丙一体成型密封胶条</b><small>江阴海达 · 耐候 EPDM</small><p>连续挤出一体成型，提升门扇闭合缓冲、隔音与气密性能。作为标准配件随产品结构联动。</p></div></article>';
    hardwareBody.append(sealCard);
  }

  // The old accordions remain available as the full engineering catalogue,
  // while these reference blocks establish the same reading order as the AI
  // artwork. Every selectable value is data-tagged so the configurator state
  // can reconcile it with the order-rule workbook without duplicating logic.
  const choice = (field, value, label) => `<button type="button" class="reference-choice" data-ref-field="${field}" data-ref-value="${value}"><span>${label}</span></button>`;
  const colorTierFor = (label) => {
    const value = String(label || '');
    if (/花繁|泰蓝|木纹|橡木|雨花/.test(value)) return 'dream';
    if (/古铜|墨金|黄铜|香槟|金色/.test(value)) return 'legend';
    return 'standard';
  };
  const swatchChoice = (field, value, label, color, tier = colorTierFor(label)) => `<button type="button" class="reference-swatch-choice" data-ref-field="${field}" data-ref-value="${value}" data-ref-color-tier="${tier}" title="${label}" aria-label="${label}"><i style="--swatch:${color}"></i><span>${label}</span></button>`;
  const installColorTierFilters = (scope) => {
    scope.querySelectorAll('.color-tier-strip').forEach((strip) => {
      if (strip.dataset.tierFilterMounted === 'true') return;
      strip.dataset.tierFilterMounted = 'true';
      const applyTier = (tier) => {
        strip.querySelectorAll('[data-ref-color-tier]').forEach((item) => item.classList.toggle('active', item.dataset.refColorTier === tier));
        const picker = strip.closest('.pdf-color-picker, .pdf-frame-color');
        picker?.querySelectorAll('.reference-swatch-choice').forEach((swatch) => {
          swatch.hidden = swatch.dataset.refColorTier !== tier;
        });
      };
      strip.addEventListener('click', (event) => {
        const button = event.target.closest('[data-ref-color-tier]');
        if (button) applyTier(button.dataset.refColorTier);
      });
      const firstAvailable = strip.closest('.pdf-color-picker, .pdf-frame-color')?.querySelector('.reference-swatch-choice:not(:disabled)');
      applyTier(firstAvailable?.dataset.refColorTier || 'standard');
    });
  };
  const sectionTitle = (eyebrow, title) => `<div class="reference-block-head"><div><span>${eyebrow}</span><h3>${title}</h3></div></div>`;
  const selectChoice = (field, options, selected = '') => `<select class="pdf-select" data-ref-field="${field}" aria-label="${field}">${options.map(([value, label]) => `<option value="${value}"${String(value) === String(selected) ? ' selected' : ''}>${label}</option>`).join('')}</select>`;
  const requestedColorProduct = ({ jinghongfu: 'jinghong', jiangchuanfu: 'jiangchuan', yuanyin: 'yuanyin', qingya: 'qingya', qinghuafu: 'qinghuafu' }[new URLSearchParams(location.search).get('product')] || new URLSearchParams(location.search).get('product') || 'ruojian');
  const pdfProductKey = { jinghong: 'jinghongfu', jiangchuan: 'jiangchuanfu' }[requestedColorProduct] || requestedColorProduct;
  const pdfSpecs = window.YADILO_PDF_CATALOG?.[`k80:${pdfProductKey}`]?.pdfSpecs || {};
  const splitCatalogColors = (value) => String(value || '').split(/[\/／]/).map((item) => item.trim()).filter((item) => item && item !== '选配');
  const catalogTextureLabel = String(pdfSpecs['饰面纹理（选配）'] || '平板（无纹理）').replace(/\(无纹理\)/g, '（无纹理）');
  const catalogProcessLabel = String(pdfSpecs['饰面处理工艺'] || '简雕');
  const catalogFrontColorLabels = splitCatalogColors(pdfSpecs['外观颜色']);
  const catalogBackColorLabels = splitCatalogColors(pdfSpecs['背板颜色']);
  const catalogHardwareParts = String(pdfSpecs['五金配置'] || '').split(/[+＋]/).map((item) => item.trim()).filter(Boolean);
  const catalogLockCode = catalogHardwareParts[0]?.match(/^[A-Z0-9-]+/i)?.[0] || '08LMYTF07D';
  const catalogHandleCodeFromPdf = catalogHardwareParts[1]?.match(/SL[-A-Z0-9]+/i)?.[0] || 'SL48F';
  // A fixed pull is part of a door's elevation, not a shared accessory.
  // Keep the reference panel scoped to the selected product so a user never
  // sees an unrelated SL48F/SL-115/SL-108 option on another door.
  const productHandleCatalog = {
    ruojian: { code: 'none', label: '无外露拉手', image: './assets/catalog/k80/products/ruojian/front-b0019857.jpg', options: [['none', '无外露拉手']] },
    yuanyin: { code: 'none', label: '圆隐一体饰面', image: './assets/catalog/k80/products/yuanyin/front-b0020027.jpg', options: [['none', '圆隐一体饰面（无外露拉手）']] },
    jiangchuan: { code: 'JC-RING', label: '江川赋双圆固定拉手', image: './assets/generated/hardware/references/k80-jiangchuan-round-pull.png', options: [['JC-RING', '江川赋双圆固定拉手'], ['none', '无外露拉手']] },
    jinghong: { code: 'none', label: '荆虹赋门面浮雕', image: './assets/catalog/k80/products/jinghong/front-b0012993.jpg', options: [['none', '门面浮雕一体（无外露拉手）']] },
    qingya: { code: 'QY-BAR', label: '清雅中部短金属拉手', image: './assets/generated/hardware/references/k80-qingya-center-pull.png', options: [['QY-BAR', '清雅中部短金属拉手'], ['none', '无外露拉手']] },
    qinghuafu: { code: 'QHF-MOON', label: '清华赋圆月固定拉手', image: './assets/generated/hardware/references/k80-qinghuafu-moon-pull.png', options: [['QHF-MOON', '清华赋圆月固定拉手'], ['none', '无外露拉手']] }
  };
  const activeHandleCatalog = productHandleCatalog[requestedColorProduct] || {
    code: catalogHandleCodeFromPdf,
    label: catalogHandleCodeFromPdf,
    image: './assets/generated/hardware/references/k80-sl48f-full-height-pull.png',
    options: [[catalogHandleCodeFromPdf, catalogHandleCodeFromPdf], ['none', '无外露拉手']]
  };
  const catalogHandleCode = activeHandleCatalog.code;
  const catalogHandleLabel = activeHandleCatalog.label;
  const catalogHandleChoices = activeHandleCatalog.options.map(([value, label]) => choice('handleCode', value, label)).join('');
  const productColorPalettes = {
    ruojian: [['影木1#', '影木1#', '#8b8176'], ['美洲橡木1#', '美洲橡木1#', '#9b7150'], ['石墨灰2#', '石墨灰2#', '#4a4d50']],
    yuanyin: [['花繁深古铜1#', '花繁深古铜1#', '#5e4b3d'], ['花繁银灰1#', '花繁银灰1#', '#8d9295'], ['香槟铜', '香槟铜', '#a77a50']],
    jiangchuan: [['花繁青古铜4#', '花繁青古铜4#', '#655f51'], ['石墨灰2#', '石墨灰2#', '#4b4d4c'], ['深古铜', '深古铜', '#604737']],
    jinghong: [['花繁青古铜3#', '花繁青古铜3#', '#615e50'], ['花繁银灰3#', '花繁银灰3#', '#878b8c'], ['墨金', '墨金', '#574a3b']],
    qingya: [['原始工艺色', '原始工艺色', '#766d63'], ['青古铜', '青古铜', '#625b4a'], ['石墨灰', '石墨灰', '#484a4b']],
    qinghuafu: [['墨绿雨花点', '墨绿雨花点', '#263b32'], ['青古铜6#', '青古铜6#', '#6b634a'], ['深墨绿', '深墨绿', '#172a24']]
  };
  const allCatalogColors = [
    ['花繁深古铜1#', '#5e4b3d'], ['花繁银灰1#', '#8d9295'], ['花繁青古铜3#', '#615e50'], ['花繁青古铜4#', '#655f51'], ['花繁银灰3#', '#878b8c'],
    ['影木1#', '#8b8176'], ['美洲橡木1#', '#9b7150'], ['石墨灰2#', '#4a4d50'], ['墨金', '#574a3b'],
    ['青古铜6#', '#6b634a'], ['深古铜', '#604737'], ['D-22k金色', '#b69a74'], ['E-22深古铜4#', '#5e4b3d'],
    ['黄铜金', '#c89a5b'], ['宝马灰', '#54585b'], ['雅黑', '#252525'], ['泰蓝炽彩', '#315d68'],
    ['原始工艺色', '#766d63'], ['墨绿雨花点', '#263b32']
  ];
  const activeProductPalette = productColorPalettes[requestedColorProduct] || productColorPalettes.ruojian;
  const processChoices = [...new Set([catalogProcessLabel, '双面精雕', '浮雕', '简雕', '单面简雕镂空', '无'])];
  const frontTextureChoices = [...new Set([catalogTextureLabel, '平板（无纹理）', '3D激光精雕纹理', '506榆木纹'])];
  const backTextureChoices = [...new Set(['平板（无纹理）', catalogTextureLabel, '506榆木纹', '3D激光精雕纹理'])];
  const colorPalette = (field, face) => {
    const catalogLabels = face === 'back' ? catalogBackColorLabels : catalogFrontColorLabels;
    const activeProductLabels = activeProductPalette.map(([value]) => value);
    const orderedLabels = [...new Set([...catalogLabels, ...activeProductLabels])];
    const swatches = new Map([...allCatalogColors, ...activeProductPalette.map(([value, , color]) => [value, color])]);
    const active = new Set(orderedLabels);
    const activeButtons = orderedLabels.map((value) => swatchChoice(field, value, value, swatches.get(value) || '#777')).join('');
    const catalogButtons = allCatalogColors.filter(([value]) => !active.has(value)).map(([value, color]) => `<button type="button" class="reference-swatch-choice catalog-only" data-ref-color-tier="${colorTierFor(value)}" disabled title="${value}（当前产品未配置）"><i style="--swatch:${color}"></i><span>${value}</span></button>`).join('');
    const optionalBack = face === 'back' && String(pdfSpecs['背板颜色'] || '').trim() === '选配';
    const optionalButton = optionalBack ? '<button type="button" class="reference-swatch-choice catalog-only" data-ref-color-tier="standard" disabled title="目录标注为选配"><i style="--swatch:#b8b0a1"></i><span>选配（目录标注）</span></button>' : '';
    return optionalButton + activeButtons + catalogButtons;
  };
  const framePalette = (field) => allCatalogColors.map(([value, color]) => swatchChoice(field, value, value, color)).join('');

  const structureBody = byFocus.structure?.querySelector('.accordion-body');
  if (structureBody) {
    const basicStructure = document.createElement('section');
    basicStructure.className = 'reference-block reference-basic-structure';
    basicStructure.innerHTML = `${sectionTitle('AI REFERENCE / 01', '门体基础')}
      <div class="reference-door-type-row reference-basic-control-row">
        <div class="reference-door-type-copy"><img class="pdf-door-type-image" data-ref-type-image src="./assets/catalog/derived/k80/door-types/door-double-v2.png" alt="对开门示意图" /><i class="pdf-door-type-glyph" data-ref-type-icon aria-hidden="true"></i><b class="reference-sr-only" data-ref-output="typeLabel">对开门</b></div>
        <div class="reference-field reference-basic-control-field reference-basic-type-field"><span>门型</span><div class="reference-door-type-options">${choice('type', 'single', '单门', '独立门扇')}${choice('type', 'mother', '子母门', '左小右大')}${choice('type', 'double', '对开门', '左右等分')}</div></div>
        <div class="reference-field reference-basic-control-field reference-basic-opening-field"><span>开向</span><div class="reference-choice-grid reference-choice-grid-2">${choice('opening', 'out-left', '外开左锁')}${choice('opening', 'out-right', '外开右锁')}${choice('opening', 'in-left', '内开左锁')}${choice('opening', 'in-right', '内开右锁')}</div></div>
      </div>
      <div class="reference-series-inline"><span>门体工艺</span><div class="reference-choice-grid reference-choice-grid-3">${choice('surfaceSeries', 'K80AL', 'K80 AL')}${choice('surfaceSeries', 'K80ST', 'K80 ST')}${choice('surfaceSeries', 'K80CU', 'K80 CU')}</div></div>`;
    structureBody.prepend(basicStructure);
  }

  const dimensionsBody = byFocus.dimensions?.querySelector('.accordion-body');
  if (dimensionsBody) {
    const dimensionReference = document.createElement('section');
    dimensionReference.className = 'reference-block reference-dimensions-summary';
    dimensionReference.innerHTML = `<div class="reference-dimensions-heading"><span>门洞尺寸</span><small>宽 × 高 × 深</small></div>
      <div class="reference-dimension-strip"><div><span>宽度</span><b data-ref-output="width">2100 mm</b></div><em>×</em><div><span>高度</span><b data-ref-output="height">2600 mm</b></div><em>×</em><div><span>深度</span><b data-ref-output="depth">120 mm</b></div></div>
      <p class="reference-source-note">门扇结构：80 mm 全钢防盗结构；门扇面板厚度、门框深度与门套深度分别按材质和收口选项记录。</p>`;
    dimensionsBody.prepend(dimensionReference);
  }

  const surfaceBody = byFocus.surface?.querySelector('.accordion-body');
  if (surfaceBody) {
    const faceReference = document.createElement('section');
    faceReference.className = 'reference-block reference-face-reference';
    faceReference.innerHTML = `${sectionTitle('CMFP / FACE DESIGN', '正面 / 背面独立配置', 'C 色彩 · M 材料 · F 表面处理工艺 · P 图形纹理；正背面按门体结构分别记录。')}
      <div class="reference-face-grid">
        <article class="reference-face-card" data-reference-face="front">
          <header><span>正面</span><select class="pdf-select reference-face-product" aria-label="正面款式" disabled><option>${productLabel}</option></select><small>主门扇外立面</small></header>
          <div class="reference-face-line"><span>材质</span><div class="reference-choice-grid reference-choice-grid-2">${choice('frontMaterial', '铝板', '铝板')}${choice('frontMaterial', '钢板', '钢板')}${choice('frontMaterial', '铜板', '铜板')}${choice('frontMaterial', '木饰面', '木饰面')}</div></div>
          <div class="reference-face-line"><span>厚度</span><div class="reference-choice-grid reference-choice-grid-3">${choice('frontThickness', '3', '3 mm')}${choice('frontThickness', '4.5', '4.5 mm')}${choice('frontThickness', '2', '2 mm')}</div></div>
          <div class="reference-face-line"><span>表面处理工艺</span><div class="reference-choice-grid reference-choice-grid-2">${processChoices.map((value) => choice('frontProcess', value, value)).join('')}</div></div>
          <div class="reference-face-line"><span>图形纹理</span><div class="reference-choice-grid reference-choice-grid-2">${frontTextureChoices.map((value) => choice('frontTextureLabel', value, value)).join('')}</div></div>
          <div class="reference-face-line"><span>色板</span><div class="pdf-color-picker"><div class="color-tier-strip" role="tablist" aria-label="正面色彩分级"><button type="button" class="active" data-ref-color-tier="standard">标准配色</button><button type="button" data-ref-color-tier="legend">传奇色彩</button><button type="button" data-ref-color-tier="dream">梦想色彩</button></div><div class="pdf-color-current"><i></i><b data-ref-output="frontReferenceColor">当前色板</b></div><div class="reference-swatch-grid">${colorPalette('frontReferenceColor', 'front')}</div></div></div>
        </article>
        <article class="reference-face-card" data-reference-face="back">
          <header><span>背面</span><select class="pdf-select reference-face-product" aria-label="背面款式" disabled><option>${productLabel}</option></select><small>室内侧结构面</small></header>
          <div class="reference-face-line"><span>材质</span><div class="reference-choice-grid reference-choice-grid-2">${choice('backMaterial', '热镀锌钢板', '背面钢板')}${choice('backMaterial', '铝板', '背面铝板')}${choice('backMaterial', '木饰面', '背面木饰面')}${choice('backMaterial', '铜板', '背面铜板')}</div></div>
          <div class="reference-face-line"><span>厚度</span><div class="reference-choice-grid reference-choice-grid-3">${choice('backThickness', '2', '2 mm')}${choice('backThickness', '3', '3 mm')}${choice('backThickness', '4.5', '4.5 mm')}</div></div>
          <div class="reference-face-line"><span>表面处理工艺</span><div class="reference-choice-grid reference-choice-grid-2">${processChoices.map((value) => choice('backProcess', value, value)).join('')}</div></div>
          <div class="reference-face-line"><span>图形纹理</span><div class="reference-choice-grid reference-choice-grid-2">${backTextureChoices.map((value) => choice('backTextureLabel', value, value)).join('')}</div></div>
          <div class="reference-face-line"><span>色板</span><div class="pdf-color-picker"><div class="color-tier-strip" role="tablist" aria-label="背面色彩分级"><button type="button" class="active" data-ref-color-tier="standard">标准配色</button><button type="button" data-ref-color-tier="legend">传奇色彩</button><button type="button" data-ref-color-tier="dream">梦想色彩</button></div><div class="pdf-color-current"><i></i><b data-ref-output="backReferenceColor">当前色板</b></div><div class="reference-swatch-grid">${colorPalette('backReferenceColor', 'back')}</div></div></div>
        </article>
      </div>`;
    surfaceBody.prepend(faceReference);
    installColorTierFilters(faceReference);

    // The compact reference layout used to hide the legacy texture viewport
    // controls along with the old accordion. Move the real, already-wired
    // controls into the visible face-design block so horizontal/vertical
    // framing remains available without duplicating state or event handlers.
    const legacyTextureTools = surfaceBody.querySelector('.texture-tools');
    if (legacyTextureTools) {
      const texturePosition = document.createElement('section');
      texturePosition.className = 'reference-block reference-texture-position';
      texturePosition.innerHTML = sectionTitle('TEXTURE VIEW / P', '纹理取景');
      texturePosition.append(legacyTextureTools);
      faceReference.append(texturePosition);
      legacyTextureTools.closest('.advanced-drawer')?.remove();
    }
  }

  const frameBody = byFocus.frame?.querySelector('.accordion-body');
  if (frameBody) {
    const frameReference = document.createElement('section');
    frameReference.className = 'reference-block reference-frame-reference';
    frameReference.innerHTML = `${sectionTitle('BASIC FRAMEWORK / 02', '门套 · 门框 · 墙面', '依据指导手册的结构拆解，门套、门框、外饰面板与墙面收口分别确认。')}
      <div class="reference-frame-stack">
        <div class="reference-spec-row"><span>外门套</span><div class="reference-choice-grid reference-choice-grid-4">${choice('outerCasing', 'Z型', 'Z 型')}${choice('outerCasing', 'W型', 'W 型')}${choice('outerCasing', 'P40', 'P40')}${choice('outerCasing', 'P70', 'P70')}</div><div class="pdf-frame-color"><div class="pdf-color-current" data-ref-preview="outerCasingColor"><i></i><b data-ref-output="outerCasingColor">D-22k金色</b></div><div class="reference-swatch-grid compact">${framePalette('outerCasingColor')}</div></div></div>
        <div class="reference-spec-row"><span>内门套</span><div class="reference-choice-grid reference-choice-grid-4">${choice('innerCasing', 'W型', 'W 型')}${choice('innerCasing', 'Z型', 'Z 型')}${choice('innerCasing', 'P40', 'P40')}${choice('innerCasing', 'WLK', 'WLK')}</div><div class="pdf-frame-color"><div class="pdf-color-current" data-ref-preview="innerCasingColor"><i></i><b data-ref-output="innerCasingColor">D-22k金色</b></div><div class="reference-swatch-grid compact">${framePalette('innerCasingColor')}</div></div></div>
        <div class="reference-spec-row"><span>门框</span><div class="reference-choice-grid reference-choice-grid-4">${choice('frameProfile', 'Z型', 'Z 型')}${choice('frameProfile', 'P40', 'P40')}${choice('frameProfile', 'P70', 'P70')}${choice('frameProfile', 'XMQ', 'XMQ')}</div><div class="pdf-frame-color"><div class="pdf-color-current" data-ref-preview="frameColor"><i></i><b data-ref-output="frameColor">D-22k金色</b></div><div class="reference-swatch-grid compact">${framePalette('frameColor')}</div></div></div>
      </div>
      <div class="reference-threshold-block"><div class="reference-field-label"><span>底槛</span><small>外开方向会过滤不适用的排水组合</small></div><div class="reference-choice-grid reference-choice-grid-3">${choice('threshold', '标配底槛', '标配底槛')}${choice('threshold', '标配底槛加高', '标配底槛加高')}${choice('threshold', '平槛', '平槛')}${choice('threshold', '底槛内排水', '底槛内排水')}${choice('threshold', '底槛氛围灯', '底槛氛围灯')}${choice('threshold', '底槛内排水和底槛氛围灯', '排水 + 氛围灯')}</div><div class="reference-toggle-row"><label><input type="checkbox" data-ref-check="thresholdLightEnabled" checked /><span>底槛氛围灯</span></label><label class="gated-option"><input type="checkbox" data-ref-check="thresholdDrainEnabled" /><span>底槛排水槽</span></label></div><label class="reference-note-input"><span>备注</span><input type="text" data-ref-field="thresholdNote" value="加高30mm" maxlength="80" /></label></div>
      <div class="reference-wall-block"><div class="reference-field-label"><span>门墙一体</span><small>仅在选择墙面模块后写入工程字段，不改变当前门扇纹理。</small></div><div class="reference-choice-grid reference-choice-grid-3">${choice('wallIntegrated', 'none', '不启用')}${choice('wallIntegrated', 'LMQ-M', 'LMQ-M')}${choice('wallIntegrated', 'LMQ-N', 'LMQ-N')}</div><div class="reference-choice-grid reference-choice-grid-3 wall-subchoices">${choice('wallModule', 'none', '无墙面模块')}${choice('wallModule', '左侧模块', '左侧模块')}${choice('wallModule', '右侧模块', '右侧模块')}</div><label class="reference-switch"><input type="checkbox" data-ref-check="wallLightEnabled" /><span>墙面氛围灯</span></label></div>`;
    frameBody.prepend(frameReference);
    ['外门套色彩分级', '内门套色彩分级', '门框色彩分级'].forEach((label, index) => {
      const picker = frameReference.querySelectorAll('.pdf-frame-color')[index];
      picker?.insertAdjacentHTML('afterbegin', `<div class="color-tier-strip" role="tablist" aria-label="${label}"><button type="button" data-ref-color-tier="standard">标准配色</button><button type="button" data-ref-color-tier="legend">传奇色彩</button><button type="button" data-ref-color-tier="dream">梦想色彩</button></div>`);
    });
    installColorTierFilters(frameReference);
  }

  const transomBody = byFocus.transom?.querySelector('.accordion-body');
  if (transomBody) {
    const transomReference = document.createElement('section');
    transomReference.className = 'reference-block reference-transom-reference';
    const transomOption = (value, label, note, image) => `<button type="button" class="transom-reference-option reference-choice" data-ref-field="transomType" data-ref-value="${value}" data-transom-type="${value}"><span class="reference-thumb"><img src="${image}" alt="" /></span><b>${label}</b><small>${note}</small></button>`;
    transomReference.innerHTML = `${sectionTitle('MATERIAL / TRANSOM 03', '气窗与玻璃', '按图标识别方形、圆弧、假气窗、玻璃真气窗与门体加高，并继续确认花件工艺。')}
      <div class="pdf-section-toggle"><label class="reference-switch"><input type="checkbox" data-ref-check="transom" /><span>气窗</span></label><small>可选则显示上方气窗形式</small></div><div class="transom-reference-grid">${transomOption('square-true', '方形封闭真气窗', '方形实体', './assets/catalog/derived/k80/transoms/square-true-v2.png')}${transomOption('square-fake', '外方形假气窗', '外侧假气窗', './assets/catalog/derived/k80/transoms/square-fake-v2.png')}${transomOption('square-glass', '方形玻璃真气窗', '实体 + 玻璃', './assets/catalog/derived/k80/transoms/square-glass-v2.png')}${transomOption('round-true', '圆弧封闭真气窗', '圆弧实体', './assets/catalog/derived/k80/transoms/round-true-v2.png')}${transomOption('round-fake', '外圆弧假气窗', '外侧假气窗', './assets/catalog/derived/k80/transoms/round-fake-v2.png')}${transomOption('round-glass', '圆弧玻璃真气窗', '圆弧 + 玻璃', './assets/catalog/derived/k80/transoms/round-glass-v2.png')}${transomOption('door-extended', '门体加高气窗', '整体加高', './assets/catalog/derived/k80/transoms/door-extended-v2.png')}${transomOption('none', '无气窗', '默认关闭', './assets/catalog/derived/k80/transoms/none-v2.png')}</div>
      <div class="transom-material-grid"><label class="reference-switch"><input type="checkbox" data-ref-check="transomFlowerEnabled" checked /><span>气窗花件</span></label><div class="reference-field"><span>主花件材质 / 厚度</span><div class="reference-choice-grid reference-choice-grid-2">${choice('transomMainMaterial', '铝花件', '铝花件')}${choice('transomMainMaterial', '镀锌钢板', '镀锌钢板')}${choice('transomMainThickness', '3', '3 mm')}${choice('transomMainThickness', '4.5', '4.5 mm')}</div></div><div class="reference-field"><span>主花件工艺</span><div class="reference-choice-grid reference-choice-grid-2">${choice('transomMainProcess', '浮雕', '浮雕')}${choice('transomMainProcess', '单面简雕镂空', '单面简雕镂空')}${choice('transomMainProcess', '激光切割', '激光切割')}</div></div><div class="reference-field gated-option"><span>花枝 / 花枝夹玻璃</span><div class="reference-choice-grid reference-choice-grid-2">${choice('transomSecondaryStyle', '花枝', '花枝')}${choice('transomSecondaryStyle', '花枝夹玻璃', '花枝夹玻璃')}</div><div class="reference-choice-grid reference-choice-grid-2">${choice('transomSecondaryThickness', '4', '4 mm')}${choice('transomSecondaryThickness', '7', '7 mm')}${choice('transomSecondaryProcess', '单面简雕镂空', '单面简雕镂空')}${choice('transomSecondaryProcess', '激光切割', '激光切割')}</div></div></div>
      <div class="reference-glass-grid"><div class="reference-field"><span>外侧玻璃</span><div class="reference-choice-grid reference-choice-grid-3">${choice('transomOuterGlass', '无', '无')}${choice('transomOuterGlass', '钢化玻璃', '钢化')}${choice('transomOuterGlass', 'LOW_E玻璃', 'LOW-E')}</div></div><div class="reference-field"><span>内侧玻璃</span><div class="reference-choice-grid reference-choice-grid-3">${choice('transomInnerGlass', '无', '无')}${choice('transomInnerGlass', '长虹玻璃', '长虹')}${choice('transomInnerGlass', '磨砂玻璃', '磨砂')}</div></div><div class="reference-field"><span>玻璃厚度</span><div class="reference-choice-grid reference-choice-grid-3">${choice('transomOuterGlassThickness', '5MM', '5 mm')}${choice('transomOuterGlassThickness', '6MM', '6 mm')}${choice('transomOuterGlassThickness', '8MM', '8 mm')}</div></div></div><p class="reference-craft-note" data-craft-note="transom">选择带玻璃的气窗后，这里会显示玻璃类型、厚度与花件工艺说明。</p>`;
    transomBody.prepend(transomReference);
  }

  if (hardwareBody) {
    const showProductLightRail = requestedColorProduct !== 'ruojian';
    const productLightRailMarkup = showProductLightRail
      ? '<div class="reference-light-rail"><div><span>产品灯带</span><b data-ref-output="lightSummary">结构灯光按产品配置</b><small>结构灯带与展厅灯光分离；电池锁具不能接入可选氛围灯。</small></div><label class="reference-switch"><input type="checkbox" data-ref-check="frameAtmosphereLightEnabled" checked /><span>门框氛围灯</span></label><p class="reference-light-warning" data-light-warning hidden>当前锁具为电池供电，页面驱动表不允许接入氛围灯。</p></div>'
      : '';
    const bomAccessoryLabel = showProductLightRail ? '密封条 · 底槛 · 氛围灯' : '密封条 · 底槛';
    const hardwareReference = document.createElement('section');
    hardwareReference.className = 'reference-block reference-hardware-reference';
    hardwareReference.innerHTML = `${sectionTitle('ACCESSORIES / 04', '五金与配件', '门内执手与锁、门外把手与锁、合页、密封条按产品结构逐项确认。')}
      <div class="hardware-reference-stack">
        <article class="hardware-reference-row" data-hardware-part="lock"><img src="./assets/generated/hardware/references/lock-smart-v2.png" alt="${catalogLockCode} 智能锁具示意图" /><div><span>锁具 / 智能拉手</span><b data-ref-output="lockPanelCode">${catalogLockCode}</b><small>目录标准配置：${pdfSpecs['五金配置'] || '产品五金按目录页联动'}</small><div class="reference-choice-grid reference-choice-grid-2">${choice('lockPanelCode', catalogLockCode, catalogLockCode)}${choice('lockPanelCode', '08LMYTF07D', '08LMYTF07D')}${choice('lockPanelCode', '07LM-Y-PLUS', '07LM-Y-PLUS')}${choice('lockPanelCode', 'none', '隐藏锁体')}</div></div></article>
        <article class="hardware-reference-row" data-hardware-part="handle"><img data-ref-hardware-preview="handle" src="${activeHandleCatalog.image}" alt="${catalogHandleLabel} 示意图" /><div><span>执手 / 固定拉手</span><b data-ref-output="handleCode">${catalogHandleLabel}</b><small>按当前门型效果图独立建模；仅显示本款可用拉手。</small><div class="reference-choice-grid reference-choice-grid-2">${catalogHandleChoices}</div></div></article>
        <article class="hardware-reference-row" data-hardware-part="seal"><img src="./assets/generated/hardware/references/epdm-seal-v2.png" alt="EPDM 三元乙丙密封胶条示意图" /><div><span>密封条</span><b data-ref-output="sealCode">EPDM-江阴海达</b><small>三道连续挤出密封 · 耐候、隔音、闭合缓冲</small><select class="pdf-select" data-ref-field="sealCode" aria-label="密封条"><option value="EPDM-江阴海达">EPDM-江阴海达</option><option value="08LMYTF07D">08LMYTF07D 配套密封条</option></select></div></article>
        <article class="hardware-reference-row" data-hardware-part="hinge"><img src="./assets/generated/hardware/references/hinge-heavy-v2.png" alt="K80 重载合页示意图" /><div><span>铰链</span><b data-ref-output="hingeCode">K80 单轴暗合页</b><small data-ref-output="hingeSpec">开启 107–110° · 承重 120 kg</small><div class="reference-choice-grid reference-choice-grid-2">${choice('hingeCode', 'K80单轴暗合页', '单轴暗合页')}${choice('hingeCode', 'K80全钢五轴合页', '全钢五轴')}${choice('hingeCode', 'K80外合页', '重载外合页')}</div></div></article>
      </div>
      ${productLightRailMarkup}
      <div class="reference-bom-tree"><span>BOM 结构</span><div><article><b>门板</b><small>正面 · 背面 · 门框门套</small></article><article><b>五金</b><small>锁具 · 执手 · 铰链</small></article><article><b>配件</b><small>${bomAccessoryLabel}</small></article></div></div>`;
    hardwareBody.prepend(hardwareReference);

    // Restore the previously available light controls next to the selected
    // handle. The product-level light rail above is intentionally removed for
    // Ruojian, but its photographed fixed groove still has a real light
    // source; keep that source control beside the handle just like the
    // integrated/ring-handle controls on the other supported products.
    const handleDetails = hardwareReference.querySelector('[data-hardware-part="handle"] > div');
    const legacyIntegratedLight = hardwareBody.querySelector('#integratedLightControls');
    const legacyRingLight = hardwareBody.querySelector('#ringLightControls');
    const legacyChannelNote = hardwareBody.querySelector('#integratedChannelNote');
    legacyChannelNote?.remove();
    if (handleDetails) {
      const lightControls = [legacyIntegratedLight, legacyRingLight].filter(Boolean);
      if (lightControls.length) {
        const lightSlot = document.createElement('div');
        lightSlot.className = 'reference-handle-light-controls';
        lightSlot.innerHTML = '<div class="reference-field-label"><span>光源配置</span><small>随当前拉手 / 固定凹槽显示</small></div>';
        lightControls.forEach((control) => lightSlot.append(control));
        lightSlot.hidden = lightControls.every((control) => control.hidden);
        handleDetails.append(lightSlot);
      }
    }
  }

  // The artwork uses a compact dropdown row for engineering values. Keep the
  // existing data-ref buttons as the source of truth, but promote each field
  // to a native select so keyboard, mobile and screen-reader interaction all
  // follow the same state path as the legacy controls.
  const promoteFieldToSelect = (scope, field, label = field) => {
    const controls = [...scope.querySelectorAll(`[data-ref-field="${field}"]`)];
    const first = controls[0];
    const grid = first?.closest('.reference-choice-grid, .reference-door-type-options');
    if (!first || !grid || grid.dataset.pdfSelectified === 'true') return;
    const options = controls.map((control) => [control.dataset.refValue, control.querySelector('span')?.textContent?.trim() || control.dataset.refValue]);
    const select = document.createElement('select');
    select.className = 'pdf-select';
    select.dataset.refField = field;
    select.setAttribute('aria-label', label);
    select.innerHTML = options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
    grid.replaceWith(select);
  };
  promoteFieldToSelect(structureBody || panel, 'type', '门型');
  promoteFieldToSelect(structureBody || panel, 'opening', '开向');
  promoteFieldToSelect(structureBody || panel, 'surfaceSeries', '门体工艺');
  ['frontMaterial', 'frontThickness', 'frontProcess', 'frontTextureLabel', 'backMaterial', 'backThickness', 'backProcess', 'backTextureLabel'].forEach((field) => promoteFieldToSelect(surfaceBody || panel, field, field));
  ['outerCasing', 'innerCasing', 'frameProfile', 'threshold', 'wallIntegrated', 'wallModule'].forEach((field) => promoteFieldToSelect(frameBody || panel, field, field));
  ['transomMainMaterial', 'transomMainThickness', 'transomMainProcess', 'transomSecondaryStyle', 'transomSecondaryThickness', 'transomSecondaryProcess', 'transomOuterGlass', 'transomInnerGlass', 'transomOuterGlassThickness'].forEach((field) => promoteFieldToSelect(transomBody || panel, field, field));
  ['lockPanelCode', 'handleCode', 'hingeCode'].forEach((field) => promoteFieldToSelect(hardwareBody || panel, field, field));

  // Native selects remain the source of truth. The shell only supplies a
  // compact chevron affordance; the selected value itself carries the label,
  // so no extra instructional badge is painted over the control.
  panel.querySelectorAll('.pdf-select:not(:disabled)').forEach((select) => {
    if (select.parentElement?.classList.contains('pdf-select-shell')) return;
    const shell = document.createElement('span');
    shell.className = 'pdf-select-shell';
    select.replaceWith(shell);
    shell.append(select);
  });

  const quickPicker = intro.querySelector('[data-quick-picker]');
  const quickFilters = {
    style: quickPicker?.querySelector('[data-quick-filter="style"]'),
    line: quickPicker?.querySelector('[data-quick-filter="line"]'),
    product: quickPicker?.querySelector('[data-quick-filter="product"]')
  };
  const quickState = { style: quickProduct.style, line: quickProduct.line, product: quickProduct.key };
  const syncQuickPicker = () => {
    if (!quickPicker) return;
    const filtered = QUICK_PRODUCT_OPTIONS.filter((item) => (!quickState.style || item.style === quickState.style) && (!quickState.line || item.line === quickState.line));
    if (!filtered.some((item) => item.key === quickState.product)) quickState.product = filtered[0]?.key || QUICK_PRODUCT_OPTIONS[0].key;
    if (quickFilters.style) quickFilters.style.value = quickState.style;
    if (quickFilters.line) quickFilters.line.value = quickState.line;
    if (quickFilters.product) {
      quickFilters.product.innerHTML = productOptions(filtered);
      quickFilters.product.value = quickState.product;
    }
    const results = quickPicker.querySelector('[data-quick-results]');
    if (results) results.innerHTML = filtered.map((item) => `<button type="button" class="quick-product-result${item.key === quickState.product ? ' selected' : ''}" data-quick-product="${safeText(item.key)}"><span><b>${safeText(item.label)}</b><small>${safeText(item.note)}</small></span><i>选择</i></button>`).join('');
  };
  const openQuickPicker = (context) => {
    if (!quickPicker) return;
    quickPicker.hidden = false;
    intro.querySelectorAll('[data-context-switch]').forEach((button) => button.setAttribute('aria-expanded', String(button.dataset.contextSwitch === context)));
    syncQuickPicker();
    const focusTarget = quickFilters[context] || quickFilters.product;
    window.setTimeout(() => focusTarget?.focus(), 0);
  };
  const closeQuickPicker = () => {
    if (!quickPicker) return;
    quickPicker.hidden = true;
    intro.querySelectorAll('[data-context-switch]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  };
  const chooseQuickProduct = (key) => {
    if (!QUICK_PRODUCT_OPTIONS.some((item) => item.key === key)) return;
    window.dispatchEvent(new CustomEvent('yadilo:quick-product-change', { detail: { product: key } }));
    closeQuickPicker();
  };
  intro.addEventListener('click', (event) => {
    const contextButton = event.target.closest('[data-context-switch]');
    if (contextButton) {
      event.preventDefault();
      openQuickPicker(contextButton.dataset.contextSwitch);
      return;
    }
    if (event.target.closest('[data-quick-picker-close]')) {
      event.preventDefault();
      closeQuickPicker();
      return;
    }
    const result = event.target.closest('[data-quick-product]');
    if (result) chooseQuickProduct(result.dataset.quickProduct);
  });
  quickPicker?.addEventListener('change', (event) => {
    const filter = event.target.closest('[data-quick-filter]');
    if (!filter) return;
    if (filter.dataset.quickFilter === 'product') chooseQuickProduct(filter.value);
    else {
      quickState[filter.dataset.quickFilter] = filter.value;
      if (filter.dataset.quickFilter === 'style') quickState.line = '入户门';
      syncQuickPicker();
    }
  });
  window.addEventListener('yadilo:quick-product-changed', (event) => {
    const next = QUICK_PRODUCT_OPTIONS.find((item) => item.key === event.detail?.product);
    if (!next) return;
    quickState.style = next.style;
    quickState.line = next.line;
    quickState.product = next.key;
    const title = intro.querySelector('.panel-title-row h1');
    if (title) title.textContent = next.label;
    const productButton = intro.querySelector('[data-context-switch="product"] span');
    if (productButton) productButton.textContent = next.label;
    const styleButton = intro.querySelector('[data-context-switch="style"] span');
    if (styleButton) styleButton.textContent = next.style;
    syncQuickPicker();
  });
  syncQuickPicker();

  accordions.forEach((section) => { section.open = true; });

  const focusByTab = { basic: 'overview', frame: 'frame', transom: 'transom', hardware: 'hardware' };
  const activeLabel = (key) => tabDefinitions.find((item) => item[0] === key)?.[2] || '基础信息';
  const activate = (key, moveFocus = false) => {
    window.dispatchEvent(new CustomEvent('yadilo:close-product-inspector'));
    tabBar.querySelectorAll('[data-config-tab]').forEach((button) => {
      const selected = button.dataset.configTab === key;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && moveFocus) button.focus();
    });
    Object.entries(panels).forEach(([panelKey, tabPanel]) => { tabPanel.hidden = panelKey !== key; });
    panel.dataset.activeConfigTab = key;
    panel.scrollTo({ top: 0, behavior: 'smooth' });
    const eventName = key === 'hardware' ? 'yadilo:hardware-focus' : 'yadilo:camera-focus';
    window.dispatchEvent(new CustomEvent(eventName, { detail: { focus: focusByTab[key] } }));
  };

  tabBar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-config-tab]');
    if (button) activate(button.dataset.configTab);
  });
  tabBar.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...tabBar.querySelectorAll('[data-config-tab]')];
    const current = buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true');
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    event.preventDefault();
    activate(buttons[next].dataset.configTab, true);
  });

  // Keep the 3D stage focused on the part currently being configured. This is
  // deliberately delegated at panel level so it also covers dynamically
  // injected reference buttons, native selects and range controls.
  const focusHardwareControl = (target) => {
    const control = target.closest('button, select, input, textarea, label');
    if (!control) return;
    const part = control.closest('[data-hardware-part]')?.dataset.hardwarePart;
    window.dispatchEvent(new CustomEvent('yadilo:hardware-focus', {
      detail: { focus: part === 'hinge' ? 'hinge' : 'hardware' }
    }));
  };
  panels.hardware.addEventListener('focusin', (event) => focusHardwareControl(event.target));
  panels.hardware.addEventListener('pointerdown', (event) => focusHardwareControl(event.target));

  // Each top-level tab owns its own restore action. Resetting one BOM branch
  // must never silently overwrite values in another branch.
  Object.entries(panels).forEach(([key, tabPanel]) => {
    const resetFooter = document.createElement('div');
    resetFooter.className = 'config-tab-reset-bar';
    resetFooter.innerHTML = `<button type="button" data-reset-config-tab="${key}"><span>还原当前标签默认值</span><b>${activeLabel(key)}</b></button>`;
    tabPanel.append(resetFooter);
    resetFooter.querySelector('button').addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('yadilo:reset-config-tab', { detail: { tab: key } }));
      resetFooter.classList.add('is-confirmed');
      window.setTimeout(() => resetFooter.classList.remove('is-confirmed'), 900);
    });
  });

  const materialPreview = document.createElement('aside');
  materialPreview.className = 'material-preview-card';
  materialPreview.hidden = true;
  materialPreview.innerHTML = `<div class="material-preview-media"><img alt="当前门体材质大图预览" /></div><div class="material-preview-copy"><span>MATERIAL PREVIEW</span><h3>原厂实拍</h3><p>保留本款完整纹理与金属反射。</p><dl><div><dt>耐晒等级</dt><dd>7–8 级</dd></div><div><dt>适用面</dt><dd>门扇正 / 背面</dd></div></dl></div>`;
  panel.insertAdjacentElement('beforebegin', materialPreview);
  const previewImage = materialPreview.querySelector('img');
  const previewTitle = materialPreview.querySelector('h3');
  const previewCopy = materialPreview.querySelector('.material-preview-copy > p');
  const productImage = (panel.querySelector('#productThumb')?.style.backgroundImage || '').match(/url\(["']?(.*?)["']?\)/)?.[1];
  if (productImage) previewImage.src = productImage;
  const previewSelector = '.texture-surface-card, .texture-variant-card, .design-preset-card, .colorway-card';
  const showMaterialPreview = (card) => {
    if (!card) return;
    previewTitle.textContent = card.querySelector('b')?.textContent?.trim() || '材质预览';
    previewCopy.textContent = card.querySelector('small')?.textContent?.trim() || '查看当前选择在真实门体上的材质效果。';
    const swatch = card.querySelector('span');
    materialPreview.style.setProperty('--preview-swatch', swatch ? getComputedStyle(swatch).background : '#8c6c52');
    materialPreview.hidden = false;
    requestAnimationFrame(() => materialPreview.classList.add('is-visible'));
  };
  const hideMaterialPreview = () => {
    materialPreview.classList.remove('is-visible');
    window.setTimeout(() => { if (!materialPreview.classList.contains('is-visible')) materialPreview.hidden = true; }, 180);
  };
  panel.addEventListener('pointerover', (event) => showMaterialPreview(event.target.closest(previewSelector)));
  panel.addEventListener('pointerout', (event) => {
    const from = event.target.closest(previewSelector);
    const to = event.relatedTarget?.closest?.(previewSelector);
    if (from && from !== to) hideMaterialPreview();
  });
  panel.addEventListener('focusin', (event) => showMaterialPreview(event.target.closest(previewSelector)));
  panel.addEventListener('focusout', (event) => { if (!event.relatedTarget?.closest?.(previewSelector)) hideMaterialPreview(); });

  activate('basic');
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('yadilo:reference-ready')), 0);
}

const schedulePrivateConfiguratorTabs = () => window.requestAnimationFrame(mountPrivateConfiguratorTabs);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedulePrivateConfiguratorTabs, { once: true });
else schedulePrivateConfiguratorTabs();
window.addEventListener('yadilo:configurator-ready', schedulePrivateConfiguratorTabs);
