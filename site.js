(function () {
  const catalog = window.YADILO_CATALOG;
  if (!catalog) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const params = new URLSearchParams(location.search);
  const page = document.body.dataset.page || 'home';
  // Keep this list aligned with the product-level texture/GLB manifests.
  // Qinghuafu already has a continuous double-leaf map and a movable main
  // design; leaving it out here made the catalogue CTA incorrectly report
  // that its modelling was unfinished.
  const modeledProducts = new Set(['ruojian', 'yuanyin', 'jiangchuanfu', 'jinghongfu', 'qinghuafu', 'jinqu', 'shirui', 'shicui', 'aige', 'songge', 'guanmin']);
  // The homepage is a discovery rail, so keep one non-configurable editorial
  // fallback while ensuring every product with a real configurator is visible
  // before products that are still catalogue-only.
  const homeEditorialProducts = new Set(['yaozhen']);

  const sortForConfiguration = (products) => products
    .map((product, index) => ({ product, index }))
    .sort((left, right) => {
      const leftRank = modeledProducts.has(left.product.slug) ? 0 : 1;
      const rightRank = modeledProducts.has(right.product.slug) ? 0 : 1;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ product }) => product);

  function bootHeader() {
    const header = $('.site-header');
    const menuButton = $('[data-menu-toggle]');
    const drawer = $('[data-menu-drawer]');
    if (!header) return;

    let previousY = window.scrollY;
    const syncHeader = () => {
      const y = window.scrollY;
      header.classList.toggle('is-solid', y > 30 || page !== 'home');
      header.classList.toggle('is-hidden', y > 120 && y > previousY && !drawer?.classList.contains('is-open'));
      previousY = y;
    };
    syncHeader();
    window.addEventListener('scroll', syncHeader, { passive: true });

    const closeMenu = () => {
      menuButton?.classList.remove('is-open');
      menuButton?.setAttribute('aria-expanded', 'false');
      drawer?.classList.remove('is-open');
      document.body.classList.remove('is-locked');
    };
    menuButton?.addEventListener('click', () => {
      const open = !drawer.classList.contains('is-open');
      drawer.classList.toggle('is-open', open);
      menuButton.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
    });
    $$('[data-menu-close], [data-menu-drawer] a').forEach((item) => item.addEventListener('click', closeMenu));
  }

  function bootReveal() {
    const items = $$('.reveal');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        instance.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  function buildCard(product) {
    const series = catalog.getSeries(product.series);
    const isConfigurable = modeledProducts.has(product.slug);
    return `<a class="product-card${isConfigurable ? ' is-configurable' : ''}" data-configurable="${isConfigurable}" href="product.html?series=${product.series}&product=${product.slug}&v=20260814.21">
      <div class="product-card-media"><img loading="lazy" src="${catalog.cover(product)}" alt="${product.name} ${series.code} 实拍或目录预览" />${product.cover.includes('pdf-previews') ? '<span class="pdf-chip">PDF CATALOGUE</span>' : ''}${isConfigurable ? '<span class="configurable-chip">可配置</span>' : ''}</div>
      <div class="product-card-body"><small>${series.code} · ${product.latin}</small><h3>${product.name}</h3><p>${product.tags}</p><div class="product-card-link"><span>查看产品详情</span><span aria-hidden="true">↗</span></div></div>
    </a>`;
  }

  function bootHome() {
    const hero = $('.hero');
    if (hero) {
      const slides = [
        { image: catalog.getSeries('k80').hero, eyebrow: 'HENG · K80 / 2026 PRIVATE COLLECTION', title: '一扇门，\n开启一种生活', copy: '从系统结构到表面细节，雅帝乐以可被长期验证的精密制造，完成家的第一道风景。' },
        { image: catalog.getSeries('d90').hero, eyebrow: 'YAO · D90 / PASSIVE SYSTEM DOOR', title: '光与风，\n进入家的秩序', copy: '被动式系统门以高性能铝型材、五腔断桥和真实产品纹理，回应自然与建筑的关系。' }
      ];
      const image = $('.hero-media img', hero), eyebrow = $('[data-hero-eyebrow]', hero), title = $('[data-hero-title]', hero), copy = $('[data-hero-copy]', hero);
      const dots = $$('[data-hero-slide]', hero);
      let active = 0;
      const applySlide = (index) => {
        active = index;
        const slide = slides[index];
        image.classList.add('is-changing');
        window.setTimeout(() => {
          image.src = slide.image;
          eyebrow.textContent = slide.eyebrow;
          title.innerHTML = slide.title.replace('\n', '<br />');
          copy.textContent = slide.copy;
          image.classList.remove('is-changing');
        }, 180);
        dots.forEach((dot, dotIndex) => dot.classList.toggle('is-active', dotIndex === index));
      };
      dots.forEach((dot, index) => dot.addEventListener('click', () => applySlide(index)));
      window.setInterval(() => applySlide((active + 1) % slides.length), 9000);
    }

    const rail = $('#productRail');
    const count = $('#productCount');
    const tabs = $$('[data-series-filter]');
    if (rail) {
      const render = (filter) => {
        const source = filter === 'all'
          ? catalog.products.filter((item) => modeledProducts.has(item.slug) || homeEditorialProducts.has(item.slug))
          : catalog.bySeries(filter);
        const products = sortForConfiguration(source).slice(0, 12);
        rail.innerHTML = products.map(buildCard).join('');
        const configurableCount = products.filter((item) => modeledProducts.has(item.slug)).length;
        if (count) count.textContent = `${products.length} 款可探索 · ${configurableCount} 款可配置`;
        tabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.seriesFilter === filter));
      };
      tabs.forEach((tab) => tab.addEventListener('click', () => render(tab.dataset.seriesFilter)));
      render('all');
    }
  }

  const NO_IMAGE_ASSET = 'assets/catalog/placeholders/no-image-door.png';
  const excelRecords = window.YADILO_EXCEL_CATALOG?.records || [];
  const normalizeCatalogName = (value) => String(value || '').replace(/[\s·（）()\-—_]/g, '').toLowerCase();

  function findCatalogProductForRecord(record) {
    if (!record) return null;
    const sourceName = normalizeCatalogName(record.name);
    const sameSeries = catalog.products.filter((product) => product.series === record.series);
    return sameSeries.find((product) => normalizeCatalogName(product.name) === sourceName)
      || sameSeries.find((product) => sourceName.includes(normalizeCatalogName(product.name)) || normalizeCatalogName(product.name).includes(sourceName))
      || null;
  }

  function excelOnlyProduct(record) {
    const series = catalog.getSeries(record.series);
    return {
      slug: '',
      name: record.name,
      latin: `EXCEL CATALOGUE / ${record.serial}`,
      series: record.series,
      seriesLabel: `${series.name} ${series.code}`,
      tags: record.style || '目录产品',
      type: params.get('type') || '以产品结构资料为准',
      structure: record.lineLabel || '产品结构待补充',
      summary: `该产品来自 Excel 在售目录，当前展示已登记的产品参数。`,
      cover: NO_IMAGE_ASSET,
      gallery: [],
      isExcelOnly: true
    };
  }

  function setProductDetail(product, exactExcelRecord = null) {
    const root = $('#productDetail');
    if (!root || !product) return;
    const series = catalog.getSeries(product.series);
    const detailImage = product.cover;
    const gallery = product.gallery?.length ? product.gallery : [detailImage];
    const galleryCaptions = ['产品主视觉', '场景与应用', '门体与五金细节', '技术参数页'];
    const galleryMarkup = gallery.map((source, index) => { const caption = product.isExcelOnly ? '暂无图片' : galleryCaptions[index] || `实拍资料 ${String(index - 3).padStart(2, '0')}`; return `<figure${product.isExcelOnly ? ' class="is-placeholder"' : ''}><img loading="${index === 0 ? 'eager' : 'lazy'}" src="${encodeURI(source)}" alt="${escapeHtml(product.name)} ${escapeHtml(caption)}" /><figcaption>${escapeHtml(caption)}</figcaption></figure>`; }).join('');
    const configProductId = ({ jiangchuanfu: 'jiangchuan', jinghongfu: 'jinghong' })[product.slug] || product.slug;
    const configPage = product.series === 'd90' ? 'd90-configurator.html' : 'glb-configurator.html';
    const configureAction = modeledProducts.has(product.slug) && !product.isExcelOnly
      ? `<a class="button-primary" href="${configPage}?series=${product.series}&product=${configProductId}&catalogId=${exactExcelRecord?.id || product.slug}&v=20260813.35">进入该产品定制 <span>↗</span></a>`
      : `<span class="button-primary is-disabled" title="${product.isExcelOnly ? '该产品暂无真实图片，不能进入配置页面' : '该单品的净面纹理和独立五金仍在建模'}">${product.isExcelOnly ? '暂无图片 · 不可配置' : '配置素材整理中'}</span>`;
    const secondaryAction = product.slug
      ? `<a class="button-ghost" href="compare.html?series=${product.series}&a=${product.slug}">加入对比 <span>+</span></a>`
      : `<a class="button-ghost" href="selection.html?series=${product.series}#product">返回产品选购 <span>←</span></a>`;
    const pdfSpecs = product.pdfSpecs || {};
    const excelRecord = exactExcelRecord || excelRecords.find((record) => {
      if (!record.active) return false;
      if (record.series !== product.series) return false;
      const sourceName = normalizeCatalogName(record.name);
      const productName = normalizeCatalogName(product.name);
      return sourceName === productName || sourceName.includes(productName) || productName.includes(sourceName);
    });
    const excelSpecs = excelRecord?.parameters || {};
    const specOrder = ['外观颜色', '背板颜色', '外板材质', '背板材质', '饰面纹理（选配）', '饰面处理工艺', '防盗结构', '门框材质', '保温隔音', '门套', '密封条材', '铰链规格', '五金配置'];
    const baseSpecs = [['产品系列', product.seriesLabel], ['门型原型', product.type], ['系统结构', product.structure]].filter(([, value]) => value);
    const sourceSpecRows = Object.entries(excelSpecs)
      .filter(([key, value]) => value && !['序号', '款式名称', '设计风格'].includes(key))
      .map(([key, value]) => [`产品表 · ${key}`, value]);
    const specRows = [...baseSpecs, ...specOrder.filter((key) => pdfSpecs[key]).map((key) => [key, pdfSpecs[key]]), ...sourceSpecRows]
      .map(([label, value]) => `<div class="spec-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`).join('');
    const pdfPages = product.pdfPage ? `${product.pdfPage}-${product.pdfPage + 3}` : '';
    const detailSource = product.isExcelOnly
      ? `<span>Excel 在售产品目录 · 编号 ${escapeHtml(excelRecord?.serial || '—')}</span><span>暂无真实产品图片</span>`
      : `<span>2026 产品目录${pdfPages ? ` · PDF ${escapeHtml(pdfPages)} 页` : ''}</span>${product.catalogSource ? `<a href="${encodeURI(product.catalogSource)}" target="_blank" rel="noreferrer">查看原始资料 ↗</a>` : ''}<span>${gallery.length} 张产品图片</span>`;
    root.innerHTML = `<div class="product-detail-gallery">${galleryMarkup}</div>
      <div class="product-detail-copy"><span class="series-label">${escapeHtml(series.code)} · ${escapeHtml(series.name)}</span><h1>${escapeHtml(product.name)}</h1><span class="latin">${escapeHtml(product.latin)}</span><p class="detail-summary">${escapeHtml(product.summary)}${product.tags ? ` 适配：${escapeHtml(product.tags)}。` : ''}</p>${product.pdfIntro ? `<p class="pdf-intro">${escapeHtml(product.pdfIntro)}</p>` : ''}<div class="detail-cta-row">${configureAction}${secondaryAction}</div><div class="detail-source">${detailSource}</div><div class="spec-table">${specRows}</div></div>`;
    document.title = `${product.name} · 雅帝乐产品详情`;
  }

  function bootProducts() {
    const grid = $('#catalogGrid');
    const filters = $$('[data-series-filter]');
    const search = $('#catalogSearch');
    const count = $('#catalogCount');
    if (!grid) return;
    let filter = params.get('series') === 'd90' ? 'd90' : params.get('series') === 'k80' ? 'k80' : 'all';
    let query = '';
    const render = () => {
      const result = catalog.products.filter((item) => (filter === 'all' || item.series === filter) && `${item.name}${item.latin}${item.tags}`.toLowerCase().includes(query.toLowerCase()));
      grid.innerHTML = result.map(buildCard).join('');
      if (count) count.textContent = `${result.length} 款产品 · 来自 2026 产品目录`;
      filters.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.seriesFilter === filter));
    };
    filters.forEach((tab) => tab.addEventListener('click', () => { filter = tab.dataset.seriesFilter; render(); }));
    search?.addEventListener('input', (event) => { query = event.target.value.trim(); render(); });
    render();
    const syncCatalogueOverview = () => {
      // The header/menu entry opens the catalogue overview. A product detail
      // is intentional only when the URL carries an explicit product or Excel
      // catalogue id; never silently select the first K80 product.
      const currentParams = new URLSearchParams(location.search);
      const hasExplicitProduct = Boolean(currentParams.get('product') || currentParams.get('catalogId'));
      if (hasExplicitProduct) return false;
      $('#productDetail').innerHTML = '';
      document.title = '雅帝乐 · 产品目录';
      return true;
    };
    if (syncCatalogueOverview()) {
      window.addEventListener('pageshow', syncCatalogueOverview);
      return;
    }
    const requestedSeries = params.get('series') === 'd90' ? 'd90' : 'k80';
    const requestedRecord = excelRecords.find((record) => record.id === params.get('catalogId') && record.active && record.series === requestedSeries) || null;
    const requestedProduct = catalog.products.find((product) => product.series === requestedSeries && product.slug === params.get('product')) || null;
    const selected = requestedRecord
      ? requestedProduct || findCatalogProductForRecord(requestedRecord) || excelOnlyProduct(requestedRecord)
      : requestedProduct || catalog.products.find((product) => product.series === requestedSeries && product.slug === catalog.getSeries(requestedSeries).defaultProduct);
    setProductDetail(selected, requestedRecord);
  }

  function bootCompare() {
    const selectors = ['compareA', 'compareB', 'compareC'].map((id) => document.getElementById(id)).filter(Boolean);
    const table = $('#compareTable');
    if (!table || selectors.length === 0) return;
    const optionMarkup = (selected) => catalog.products.map((item) => `<option value="${item.series}:${item.slug}" ${item.series + ':' + item.slug === selected ? 'selected' : ''}>${item.series.toUpperCase()} · ${item.name}</option>`).join('');
    const defaults = [params.get('a') ? `k80:${params.get('a')}` : 'k80:ruojian', params.get('b') ? `d90:${params.get('b')}` : 'd90:shirui', 'd90:jinqu'];
    selectors.forEach((select, index) => { select.innerHTML = optionMarkup(defaults[index]); });
    const rows = [['系列', 'seriesLabel'], ['适配门型', 'type'], ['门扇结构', 'structure'], ['门扇厚度', 'thickness'], ['门框材质', 'frame'], ['门套体系', 'casing'], ['密封系统', 'seal'], ['合页', 'hinge'], ['五金配置', 'hardware'], ['产品语言', 'tags']];
    const render = () => {
      const products = selectors.map((select) => { const [series, slug] = select.value.split(':'); return catalog.getProduct(series, slug); });
      table.innerHTML = `<thead><tr><th>比较维度</th>${products.map((item) => `<th>${item.name}<small>${item.series.toUpperCase()} · ${item.latin}</small></th>`).join('')}</tr></thead><tbody>${rows.map(([label, key]) => `<tr><th>${label}</th>${products.map((item) => `<td>${item[key]}</td>`).join('')}</tr>`).join('')}</tbody>`;
    };
    selectors.forEach((select) => select.addEventListener('change', render));
    render();
  }

  bootHeader();
  bootReveal();
  if (page === 'home') bootHome();
  if (page === 'products') bootProducts();
  if (page === 'compare') bootCompare();
})();
