(function () {
  const catalog = window.YADILO_CATALOG || { products: [], getSeries: () => ({}) };
  const excelRecords = window.YADILO_EXCEL_CATALOG?.records || [];
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const normalize = (value) => String(value ?? '').replace(/[\s·（）()\-—_]/g, '').toLowerCase();
  const encoded = (value) => encodeURI(String(value ?? ''));
  const params = new URLSearchParams(location.search);
  const NO_IMAGE_ASSET = 'assets/catalog/placeholders/no-image-door.png';
  const hashKey = location.hash.replace('#', '');
  let savedSelection = null;
  try { savedSelection = JSON.parse(sessionStorage.getItem('yadilo-selection') || 'null'); } catch (error) { /* private mode can reject session storage */ }

  const STEPS = [
    { key: 'type', label: '门型筛选' },
    { key: 'series', label: '系列' },
    { key: 'line', label: '工艺' },
    { key: 'style', label: '风格' },
    { key: 'product', label: '产品' }
  ];
  const DOOR_TYPES = [
    { key: 'single', label: '单门', subtitle: '一扇主门，适合标准门洞', meta: '900–1300 × 2200–3000 mm' },
    { key: 'mother', label: '子母门', subtitle: '左窄子门 · 右宽主门', meta: '1100–1700 × 2300–3100 mm' },
    { key: 'double', label: '对开门', subtitle: '左右两扇对称开启', meta: '1800–2400 × 2300–3200 mm' },
    { key: 'sideLight', label: '单边边门', subtitle: '主门 + 一侧边门', meta: '1600–2300 × 2300–3100 mm' },
    { key: 'doubleSide', label: '双边边门', subtitle: '主门 + 左右两侧边门', meta: '2400–3600 × 2300–3200 mm' }
  ];
  const SERIES = [
    { key: 'k80', code: 'K80', name: '衡境', subtitle: '系统装甲门', description: '全钢结构与自由饰面，适合从现代极简到东方语汇的完整产品线。', stat: 'ST · AL · CU · WV' },
    { key: 'd90', code: 'D90', name: '曜境', subtitle: '高端系统门', description: '高性能系统门，以岩板、铝、铜与玻璃构成更完整的建筑界面。', stat: 'D90 SYSTEM' }
  ];
  const LINE_OPTIONS = {
    k80: [
      { key: 'ST', code: 'ST', title: '钢制防盗门', description: 'K80ST · 稳定、克制的金属门体', note: '钢制 · 防盗结构' },
      { key: 'AL', code: 'AL', title: '铸铝门', description: 'K80AL · 浮雕与精雕饰面', note: '铝板 · 多种工艺' },
      { key: 'CU', code: 'CU', title: '铜门', description: 'K80CU · 铜材质的时间质感', note: '铜板 · 手工质感' },
      { key: 'WV', code: 'WV', title: '木饰面', description: 'K80WV · 温润的木质表情', note: '木饰面 · 平板纹理' }
    ],
    d90: [{ key: 'D90', code: 'D90', title: '高端系统门', description: 'D90 · 岩板、铝、铜、玻璃的系统组合', note: '系统门 · 90 mm' }]
  };
  const DOOR_TYPE_IMAGES = {
    single: 'assets/catalog/k80/products/ruojian/front-b0019857.jpg',
    mother: 'assets/catalog/k80/products/yuanyin/front-b0020027.jpg',
    double: 'assets/catalog/derived/k80/door-skins/k80-qinghuafu-double-leaf.png',
    sideLight: 'assets/catalog/brand/collection-system.jpg',
    doubleSide: 'assets/catalog/d90/products/shirui/front-b0019720.jpg'
  };
  const LINE_IMAGES = {
    ST: 'assets/catalog/k80/products/ruojian/front-b0019857.jpg',
    AL: 'assets/catalog/derived/k80/door-skins/k80-qinghuafu-double-leaf.png',
    CU: 'assets/catalog/k80/products/jiangchuan/front-b0003064.jpg',
    WV: 'assets/catalog/brand/collection-entry.jpg',
    D90: 'assets/catalog/brand/collection-villa.jpg'
  };
  const GUIDE_PALETTE = [
    { color: '#181715', label: 'Graphite / 石墨黑' },
    { color: '#80654f', label: 'Bronze / 铜棕' },
    { color: '#9ca29a', label: 'Salt grey / 海盐灰' },
    { color: '#eee9e1', label: 'Paper / 纸张白' }
  ];
  const MODEL_ALIASES = [
    { id: 'ruojian', names: ['雅帝若简', '若简'] },
    { id: 'yuanyin', names: ['雅帝圆隐', '圆隐'] },
    { id: 'jiangchuan', names: ['雅帝江川赋', '江川赋'] },
    { id: 'jinghong', names: ['雅帝荆虹赋', '荆虹赋'] },
    { id: 'qingya', names: ['雅帝清雅', '清雅'] },
    { id: 'qinghuafu', names: ['雅帝清华赋', '清华赋'] },
    { id: 'jinqu', names: ['金曲'] },
    { id: 'shirui', names: ['世瑞'] },
    { id: 'shicui', names: ['拾翠'] },
    { id: 'aige', names: ['爱格'] },
    { id: 'songge', names: ['颂歌'] },
    { id: 'guanmin', names: ['冠冕'] }
  ];
  const REQUEST_MODEL_ALIASES = { jiangchuanfu: 'jiangchuan', jinghongfu: 'jinghong' };
  const modeledIds = new Set(MODEL_ALIASES.map((item) => item.id));
  const requestedModelId = REQUEST_MODEL_ALIASES[params.get('product')] || params.get('product') || '';
  const requestedCatalogId = params.get('catalogId') || (hashKey === 'spec' ? savedSelection?.productId || '' : '');
  const modelSlugVariants = (model) => model === 'jiangchuan' ? ['jiangchuan', 'jiangchuanfu'] : model === 'jinghong' ? ['jinghong', 'jinghongfu'] : [model];

  const initialSeries = MODEL_ALIASES.find((item) => item.id === requestedModelId)?.id
    ? (['jinqu', 'shirui', 'shicui', 'aige', 'songge', 'guanmin'].includes(requestedModelId) ? 'd90' : 'k80')
    : (params.get('series') === 'd90' ? 'd90' : 'k80');
  const state = {
    step: Math.max(0, STEPS.findIndex((item) => item.key === location.hash.replace('#', ''))),
    type: DOOR_TYPES.some((item) => item.key === params.get('type')) ? params.get('type') : 'double',
    typeSelected: DOOR_TYPES.some((item) => item.key === params.get('type')),
    series: initialSeries,
    seriesSelected: ['k80', 'd90'].includes(params.get('series')) || Boolean(requestedModelId),
    line: params.get('line') || (initialSeries === 'd90' ? 'D90' : 'AL'),
    lineSelected: Boolean(params.get('line') || requestedModelId),
    style: '',
    styleSelected: Boolean(params.get('style')),
    productId: '',
    productSelected: false,
    productSearch: '',
  };

  const findModel = (record) => {
    const text = normalize(record?.name);
    const explicit = requestedModelId;
    const modelMatchesSeries = (model) => catalog.products?.some((item) => item.series === record?.series && modelSlugVariants(model).includes(item.slug));
    if (explicit && modelMatchesSeries(explicit) && MODEL_ALIASES.some((item) => item.id === explicit && item.names.some((name) => text.includes(normalize(name))))) return explicit;
    const alias = MODEL_ALIASES.find((item) => modelMatchesSeries(item.id) && item.names.some((name) => text.includes(normalize(name))));
    if (alias) return alias.id;
    const existing = catalog.products?.find((item) => item.series === record?.series && (normalize(item.name) === text || text.includes(normalize(item.name)) || normalize(item.name).includes(text)));
    return existing?.slug || '';
  };
  const findExisting = (record) => {
    const id = findModel(record);
    return id ? catalog.products?.find((item) => item.series === record?.series && modelSlugVariants(id).includes(item.slug)) || null : null;
  };
  const hasProductImage = (record) => Boolean(findExisting(record)?.cover);
  const isConfigurable = (record) => {
    const model = record ? findModel(record) : '';
    return Boolean(record?.active && hasProductImage(record) && model && modeledIds.has(model));
  };
  const recordById = (id) => excelRecords.find((record) => record.id === id && record.active && ['k80', 'd90'].includes(record.series)) || null;
  const seriesRecords = () => excelRecords.filter((record) => record.series === state.series && record.active);
  const lineRecords = () => seriesRecords().filter((record) => state.series !== 'k80' || !state.lineSelected || !state.line || record.line === state.line);
  const styleRecords = () => lineRecords().filter((record) => !state.style || record.style === state.style);

  function prepareInitialProduct() {
    const requestedModel = requestedModelId;
    const foundByCatalogId = requestedCatalogId ? recordById(requestedCatalogId) : null;
    const foundByModel = requestedModel
      ? excelRecords.find((record) => record.active && findModel(record) === requestedModel && record.series === state.series)
      : null;
    const found = foundByCatalogId || foundByModel;
    if (!found) return;
    applyProductContext(found);
    state.step = 4;
    return found;
  }

  function applyProductContext(record) {
    state.productId = record.id;
    state.productSelected = true;
    if (['k80', 'd90'].includes(record.series)) {
      state.series = record.series;
      state.seriesSelected = true;
    }
    const lineOption = (LINE_OPTIONS[state.series] || []).find((item) => item.key === record.line);
    if (lineOption) {
      state.line = lineOption.key;
      state.lineSelected = true;
    }
    state.style = record.style || '';
    state.styleSelected = Boolean(state.style);
    if (!state.typeSelected) {
      state.type = DOOR_TYPES.some((item) => item.key === savedSelection?.type) ? savedSelection.type : state.type;
      state.typeSelected = true;
    }
  }

  function persistSelection() {
    try { sessionStorage.setItem('yadilo-selection', JSON.stringify({ ...state, record: recordById(state.productId) })); } catch (error) { /* private mode can reject session storage */ }
  }

  function setState(field, value) {
    state[field] = value;
    if (field === 'type') {
      state.typeSelected = true;
      goTo(1);
      return;
    }
    if (field === 'series') {
      state.seriesSelected = true;
      state.lineSelected = false;
      state.styleSelected = false;
      state.line = '';
      state.style = '';
      state.productId = '';
      state.productSelected = false;
      // Keep the confirmed cascade intact: a series narrows the catalogue,
      // then the user chooses its material/process line before styles and
      // individual products. Jumping directly to the product step made the
      // series selection look ineffective because every record in that
      // series was rendered at once.
      goTo(2);
      return;
    }
    if (field === 'line') {
      state.lineSelected = true;
      state.styleSelected = false;
      state.productId = '';
      state.productSelected = false;
    }
    if (field === 'style') {
      state.styleSelected = true;
      state.productId = '';
      state.productSelected = false;
      state.productSearch = '';
    }
    render();
  }

  function stylesForCurrentLine() {
    const styles = [...new Set(lineRecords().map((record) => record.style).filter(Boolean))];
    const priority = ['现代简约', '新中式', '轻美式', '法式风格', '轻奢风', '复古风', '原木风', '侘寂风'];
    return styles.sort((a, b) => (priority.indexOf(a) + 99) - (priority.indexOf(b) + 99) || a.localeCompare(b, 'zh-CN'));
  }

  function currentProducts() {
    const query = normalize(state.productSearch);
    return styleRecords()
      .filter((record) => record.active)
      .filter((record) => !query || normalize(`${record.name}${record.serial}${record.style}${record.parameters['基板纹理'] || ''}`).includes(query))
      .sort((a, b) => Number(findModel(b) !== '') - Number(findModel(a) !== '') || Number(b.active) - Number(a.active) || String(a.serial).localeCompare(String(b.serial), 'zh-CN'));
  }

  function imageFor(record) {
    const existing = findExisting(record);
    return existing?.cover || NO_IMAGE_ASSET;
  }

  function renderProductVisual(record, alt, noImageClass = 'product-card-no-image', loading = 'lazy') {
    const image = imageFor(record);
    const missing = !hasProductImage(record);
    if (!missing) return `<img loading="${loading}" src="${encoded(image)}" alt="${escapeHtml(alt)}" />`;
    return `<div class="${noImageClass}" role="img" aria-label="暂无图片"><img loading="${loading}" src="${encoded(image)}" alt="暂无图片" /><strong>暂无图片</strong><small>暂未导入产品图</small></div>`;
  }

  function displayStyle(style) {
    return style === '现代简约' ? '现代' : style === '新中式' ? '中国式' : style;
  }

  function imageUrl(value) {
    return encoded(value || catalog.getSeries(state.series)?.hero || 'assets/catalog/brand/collection-system.jpg');
  }

  function renderMasthead({ eyebrow, title, subtitle, description, image, alt, note, visual = true }) {
    const visualMarkup = visual ? `<figure class="selection-mast-visual"><img src="${imageUrl(image)}" alt="${escapeHtml(alt)}" /><span>${escapeHtml(note || 'YADILO · PRODUCT STUDY')}</span><figcaption>真实产品图 · 用于建立材质、比例与场景感</figcaption></figure>` : '';
    return `<div class="selection-masthead${visual ? '' : ' is-no-visual'} reveal-item"><div class="selection-mastcopy"><div class="selection-eyebrow">${escapeHtml(eyebrow)}</div><h1 class="selection-heading">${escapeHtml(title)}<span>${escapeHtml(subtitle)}</span></h1><p class="selection-description">${escapeHtml(description)}</p><div class="selection-palette" aria-label="设计指导手册提取色彩">${GUIDE_PALETTE.map((item) => `<span class="palette-swatch" title="${escapeHtml(item.label)}" style="--swatch:${item.color}"></span>`).join('')}<small>CMFP / 设计基因</small></div></div>${visualMarkup}</div>`;
  }

  function renderVisualOption({ field, value, index, title, subtitle, meta, image, alt, selected, badge }) {
    return `<button class="option-card visual-option-card reveal-item${selected ? ' is-selected' : ''}" type="button" data-select-field="${escapeHtml(field)}" data-value="${escapeHtml(value)}" style="--card-delay:${index * 55}ms"><span class="option-card-media"><img loading="lazy" src="${imageUrl(image)}" alt="${escapeHtml(alt || title)}" /></span><span class="option-card-shade"></span><span class="option-card-body"><span class="option-index">0${index + 1}</span><span class="option-title">${escapeHtml(title)}</span><span class="option-subtitle">${escapeHtml(subtitle)}</span><span class="option-meta">${escapeHtml(meta)}</span><span class="option-arrow">↗</span></span>${badge ? `<span class="option-card-badge">${escapeHtml(badge)}</span>` : ''}</button>`;
  }

  function renderMaterialRail() {
    return `<div class="material-rail reveal-item"><span class="material-rail-label">设计指导手册 / DESIGN GUIDE</span><span>结构</span><span>色彩</span><span>材料</span><span>工艺</span><span>纹理</span><span class="material-rail-rule"></span><small>独立饰面 · 精准尺寸 · 可组合五金</small></div>`;
  }

  function parameterValue(record, keys) {
    for (const key of keys) {
      if (record?.parameters?.[key]) return record.parameters[key];
    }
    return '';
  }

  function renderProgress() {
    const progress = $('#selectionProgress');
    progress.innerHTML = STEPS.map((item, index) => `<button class="progress-step${index === state.step ? ' is-current' : ''}${index < state.step ? ' is-complete' : ''}" type="button" data-step-index="${index}" aria-current="${index === state.step ? 'step' : 'false'}"><span class="progress-number">0${index + 1}</span><span class="progress-label">${item.label}</span></button>`).join('');
  }

  function renderTypeStep() {
    return `${renderMasthead({ eyebrow: '01 / PRODUCT FILTER', title: '先按门型筛选产品', subtitle: '从五种门体结构开始，再确认系列与具体款式。', description: '门型筛选只用于缩小目录范围，不会直接修改门体。选定具体产品后，再进入独立定制页面调整尺寸、纹理与五金。', visual: false })}<div class="option-grid option-grid-types">${DOOR_TYPES.map((item, index) => renderVisualOption({ field: 'type', value: item.key, index, title: item.label, subtitle: item.subtitle, meta: item.meta, image: DOOR_TYPE_IMAGES[item.key], alt: `${item.label}门体参考`, selected: state.type === item.key, badge: index === 1 ? '结构原型' : '' })).join('')}</div>`;
  }

  function renderSeriesStep() {
    return `${renderMasthead({ eyebrow: '02 / PRODUCT SERIES', title: '选择产品系列', subtitle: '从 K80 系统装甲门，到 D90 高端系统门。', description: '系列决定可浏览的真实产品范围；门体的具体定制将在选定产品后单独进行。先确认系列，再继续筛选工艺与风格。', visual: false })}<div class="option-grid is-two">${SERIES.map((item, index) => { const count = excelRecords.filter((record) => record.series === item.key && record.active).length; return renderVisualOption({ field: 'series', value: item.key, index, title: `${item.code} · ${item.name}`, subtitle: item.subtitle, meta: `${count} 款在售产品 · ${item.stat}`, image: item.key === 'k80' ? 'assets/catalog/brand/collection-system.jpg' : 'assets/catalog/brand/collection-villa.jpg', alt: `${item.code} ${item.name} 系列`, selected: state.series === item.key, badge: item.key === state.series ? '当前系列' : '' }); }).join('')}</div>`;
  }

  function renderLineStep() {
    const allOptions = LINE_OPTIONS[state.series] || [];
    const options = allOptions.filter((item) => seriesRecords().some((record) => record.active && (state.series !== 'k80' || record.line === item.key)));
    return `${renderMasthead({ eyebrow: '03 / PRODUCT LINE', title: '选择产品工艺', subtitle: state.series === 'k80' ? 'K80 按在售工艺路线浏览。' : 'D90 以高端系统门产品线为主。', description: '工艺路线对应材料与结构，是产品目录的筛选线索；实际饰面与零部件会在产品独立页面中拆分配置。', image: LINE_IMAGES[state.line] || catalog.getSeries(state.series)?.hero, alt: '雅帝乐材料与工艺参考', note: 'CMFP / MATERIAL + FINISH'})}<div class="option-grid${options.length === 2 ? ' is-two' : options.length === 1 ? ' is-two' : ' is-four'}">${options.map((item, index) => { const count = seriesRecords().filter((record) => record.active && (state.series !== 'k80' || record.line === item.key)).length; return renderVisualOption({ field: 'line', value: item.key, index, title: item.code, subtitle: item.title, meta: `${count} 条在售产品记录 · ${item.note}`, image: LINE_IMAGES[item.key] || catalog.getSeries(state.series)?.hero, alt: `${item.title}工艺参考`, selected: state.line === item.key, badge: item.code === 'CU' ? '时间质感' : '' }); }).join('')}</div>${renderMaterialRail()}`;
  }

  function renderStyleStep() {
    const styles = stylesForCurrentLine();
    const firstStyle = styles.find((style) => style === state.style) || styles[0];
    const styleRecord = firstStyle ? lineRecords().find((record) => record.style === firstStyle) : null;
    return `${renderMasthead({ eyebrow: '04 / PRODUCT STYLE', title: '选择产品风格', subtitle: '从标签进入真实款式，再确认具体门面。', description: '风格标签来自产品目录，仅用于找到具体产品；门扇纹理、颜色、门型和五金等定制项会在独立产品页中配置。', image: styleRecord ? imageFor(styleRecord) : catalog.getSeries(state.series)?.hero, alt: `${firstStyle || '雅帝乐'}风格参考`, note: 'GRAPHIC / PATTERN'})}<div class="style-grid">${styles.map((style, index) => { const count = lineRecords().filter((record) => record.style === style).length; const record = lineRecords().find((item) => item.style === style); return renderVisualOption({ field: 'style', value: style, index, title: displayStyle(style), subtitle: style, meta: `${count} 款产品`, image: record ? imageFor(record) : catalog.getSeries(state.series)?.hero, alt: `${style}风格产品参考`, selected: state.style === style, badge: style === '新中式' ? '纹样感' : '' }); }).join('')}</div>${renderMaterialRail()}`;
  }

  function renderProductStep() {
    const products = currentProducts();
    const series = SERIES.find((item) => item.key === state.series);
    const line = state.lineSelected ? (LINE_OPTIONS[state.series] || []).find((item) => item.key === state.line)?.title || state.line : '全部工艺';
    const style = state.styleSelected && state.style ? state.style : '全部设计风格';
    const productScope = [series ? `${series.code} · ${series.name}` : state.series, line, style].filter(Boolean).join(' · ');
    return `<div class="selection-eyebrow reveal-item">05 / CATALOGUE PRODUCT</div><div class="selection-content-head reveal-item"><div><h1 class="selection-heading">选择具体产品<span>${escapeHtml(productScope)}</span></h1><p class="selection-description">这里仅展示 Excel 目录中当前在售且有正式产品名称的门产品。名称标注下架、以英文字母开头，以及仅有数字或型号代码的记录均已排除；没有真实产品图的正式产品保留展示，但不能进入配置页面。</p></div><span class="selection-count">${products.length} 款匹配</span></div><div class="product-toolbar reveal-item"><span class="selection-count">Excel 在售产品 · 正式款名</span><input class="product-search" id="productSearch" type="search" value="${escapeHtml(state.productSearch)}" placeholder="搜索产品名称 / 编号" /></div>${products.length ? `<div class="product-grid">${products.map((record, index) => { const hasImage = hasProductImage(record); const configurable = isConfigurable(record); const statusLabel = !hasImage ? '暂无图片' : configurable ? '已有独立定制页' : '目录参数'; return `<button class="product-card-select reveal-item${record.id === state.productId ? ' is-selected' : ''}${hasImage ? '' : ' is-no-image'}" type="button" data-product-id="${escapeHtml(record.id)}" style="--card-delay:${Math.min(index, 12) * 45}ms"><div class="product-card-media">${renderProductVisual(record, `${record.name} 产品预览`)}<span class="product-card-badge${configurable ? '' : ' is-muted'}">${statusLabel}</span><span class="product-card-focus">${hasImage ? '查看详情 ↗' : '查看参数 ↗'}</span></div><div class="product-card-content"><small>${escapeHtml(record.lineLabel)} · ${escapeHtml(record.style || '未分类')}</small><h3>${escapeHtml(record.name)}</h3><p>${escapeHtml(parameterValue(record, ['工艺', '正面板材及厚度', '基板纹理']) || (hasImage ? '产品参数已登记，可继续查看。' : '暂无产品图片，不能进入配置页面。'))}</p><span class="product-card-more"><span>编号 ${escapeHtml(record.serial)}</span><b>${hasImage ? '查看产品详情 →' : '查看产品参数 →'}</b></span></div></button>`; }).join('')}</div>` : '<div class="empty-state">当前筛选条件没有匹配的产品，请返回调整工艺或设计风格。</div>'}`;
  }

  function renderSummary() {
    const type = DOOR_TYPES.find((item) => item.key === state.type);
    const series = SERIES.find((item) => item.key === state.series);
    const line = (LINE_OPTIONS[state.series] || []).find((item) => item.key === state.line);
    const record = recordById(state.productId);
    const model = record ? findModel(record) : '';
    const value = (text, empty = '待选择') => `<dd class="${text ? '' : 'is-empty'}">${escapeHtml(text || empty)}</dd>`;
    const selectedRecord = state.productSelected ? record : null;
    const matchingProducts = state.step >= 4 && state.seriesSelected ? currentProducts() : [];
    const previewRecord = selectedRecord || matchingProducts[0] || null;
    const previewModel = previewRecord ? findModel(previewRecord) : '';
    const previewImage = previewRecord ? imageFor(previewRecord) : '';
    const previewThumb = previewImage ? `<img src="${encoded(previewImage)}" alt="${escapeHtml(previewRecord.name)}" />` : '<span class="summary-product-no-image">暂无图片</span>';
    const canConfigure = isConfigurable(selectedRecord);
    const canAdvance = state.step < 4 || (state.step === 4 && Boolean(selectedRecord));
    const summarySeries = state.seriesSelected ? series : null;
    const summaryLine = state.lineSelected ? line : null;
    const summaryStyle = state.styleSelected ? (selectedRecord?.style ? displayStyle(selectedRecord.style) : state.style) : '';
    const continueLabel = state.step === STEPS.length - 1
      ? (selectedRecord ? '查看产品详情 ↗' : '请先选择产品')
      : '继续 →';
    const productSummary = previewRecord
      ? `<div class="summary-product${selectedRecord ? '' : ' is-preview'}"><div class="summary-product-thumb">${previewThumb}</div><div><b>${escapeHtml(previewRecord.name)}</b><small>${selectedRecord ? `${escapeHtml(previewRecord.lineLabel)} · ${canConfigure ? '已有独立定制页' : hasProductImage(previewRecord) ? '目录参数已登记' : '暂无图片 · 不可配置'}` : '筛选结果预览 · 请点击左侧产品卡片确认'}</small></div></div>`
      : (state.step >= 4 ? '<div class="summary-selection-hint">当前筛选暂无匹配产品，请返回调整系列、工艺或风格。</div>' : '<div class="summary-selection-hint">完成系列、工艺和风格筛选后，这里会显示匹配的产品。</div>');
    return `<p class="summary-kicker">YADILO / PRODUCT SELECTION</p><h2 class="summary-title">产品选购<span>从系列目录中确认具体产品</span></h2><div class="summary-rule"></div><dl class="summary-list"><div class="summary-row"><dt>门型筛选</dt>${value(state.typeSelected ? type?.label : '')}</div><div class="summary-row"><dt>系列</dt>${value(summarySeries ? `${summarySeries.code} · ${summarySeries.name}` : '')}</div><div class="summary-row"><dt>工艺</dt>${value(summaryLine?.title || '')}</div><div class="summary-row"><dt>风格</dt>${value(summaryStyle)}</div></dl>${productSummary}<button class="selection-button summary-continue${!canAdvance ? ' is-disabled' : ''}" type="button" data-action="continue">${continueLabel}</button><span class="summary-status">当前选购条件会带入产品详情页</span><p class="summary-footnote">选中产品后统一进入产品详情页；有完整配置素材的产品可继续定制，没有真实图片的产品仅展示 Excel 参数。</p>`;
  }

  function render() {
    renderProgress();
    const view = $('#selectionView');
    const stepRenderer = [renderTypeStep, renderSeriesStep, renderLineStep, renderStyleStep, renderProductStep][state.step] || renderTypeStep;
    view.classList.remove('is-rendered');
    view.innerHTML = stepRenderer();
    $('#selectionSummary').innerHTML = renderSummary();
    requestAnimationFrame(() => view.classList.add('is-rendered'));
    const search = $('#productSearch');
    search?.addEventListener('input', (event) => { state.productSearch = event.target.value; render(); requestAnimationFrame(() => { const input = $('#productSearch'); input?.focus(); input?.setSelectionRange(state.productSearch.length, state.productSearch.length); }); });
  }

  function goTo(step) {
    if (step < 0 || step >= STEPS.length) return;
    state.step = step;
    const nextParams = new URLSearchParams(location.search);
    if (state.productSelected && state.productId) nextParams.set('catalogId', state.productId);
    else nextParams.delete('catalogId');
    const nextQuery = nextParams.toString();
    history.replaceState(null, '', `${location.pathname}${nextQuery ? `?${nextQuery}` : ''}#${STEPS[step].key}`);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildProductUrl(record = recordById(state.productId)) {
    if (!record) return '';
    const existing = findExisting(record);
    const next = new URLSearchParams({ series: record.series, catalogId: record.id, from: 'selection' });
    if (existing?.slug) next.set('product', existing.slug);
    if (state.typeSelected) next.set('type', state.type);
    if (record.line) next.set('line', record.line);
    if (record.style) next.set('style', record.style);
    persistSelection();
    return `./product.html?${next.toString()}&v=20260814.21`;
  }

  document.addEventListener('click', (event) => {
    const field = event.target.closest('[data-select-field]');
    if (field) { setState(field.dataset.selectField, field.dataset.value); return; }
    const product = event.target.closest('[data-product-id]');
    if (product) { const record = recordById(product.dataset.productId); if (!record) return; applyProductContext(record); const url = buildProductUrl(record); if (url) location.href = url; return; }
    const step = event.target.closest('[data-step-index]');
    if (step) { goTo(Number(step.dataset.stepIndex)); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'back') goTo(state.step - 1);
    if (action.dataset.action === 'continue') {
      if (state.step === 1) {
        if (state.seriesSelected) goTo(2);
        return;
      }
      if (state.step < STEPS.length - 1) { goTo(state.step + 1); return; }
      const url = buildProductUrl();
      if (url) location.href = url;
    }
  });

  const hashStep = STEPS.findIndex((item) => item.key === location.hash.replace('#', ''));
  if (hashStep >= 0 && !params.get('product')) state.step = hashStep;
  const initialProduct = prepareInitialProduct();
  if (hashKey === 'spec' && initialProduct) {
    const url = buildProductUrl(initialProduct);
    if (url) { location.replace(url); return; }
  }
  render();
})();
