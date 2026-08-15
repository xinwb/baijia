/*
 * YADILO 2026 catalog data
 *
 * Product names, series language and specification vocabulary are transcribed
 * from assets/source/docs/catalog/Catalog_20260806交互_zxj(1).pdf. Each
 * product keeps the four-page PDF sequence (main visual, scene, details and
 * parameters), with every normalized local product photograph appended when
 * available.
 */
(function () {
  const pdfCatalog = window.YADILO_PDF_CATALOG || {};
  const pdfPreview = (series, slug) => `assets/catalog/pdf-previews/${series}/${slug}/page-01.jpg`;

  const k80 = [
    ['ruojian', '雅帝若简', 'YA DI RUOJIAN', 31, '现代极简 · 轻侘寂 · 现代轻奢', 'assets/catalog/k80/products/ruojian/front-b0019857.jpg'],
    ['yijian', '雅帝意简', 'YA DI YIJIAN', 35, '现代轻奢 · 侘寂 · 轻复古意式'],
    ['heya', '雅帝和雅', 'YA DI HEYA', 39, '现代简约 · 极简轻奢 · 新中式'],
    ['ouya', '雅帝欧雅', 'YA DI OUYA', 43, '现代轻奢 · 艺术装饰 · 意式轻复古'],
    ['suya', '雅帝素雅', 'YA DI SUYA', 47, '现代极简 · 轻奢住宅 · 大平层'],
    ['ruoya', '雅帝若雅', 'YA DI RUOYA', 51, '现代简约 · 自然风 · 现代轻奢'],
    ['liujing', '雅帝流景', 'YA DI LIUJING', 55, '现代轻奢 · 极简 · 光影设计'],
    ['liuying', '雅帝流影', 'YA DI LIUYING', 59, '现代轻奢 · 现代极简 · 意式'],
    ['xinghui', '雅帝星回', 'YA DI XINGHUI', 63, '现代轻奢 · 都市侘寂 · 轻复古'],
    ['xinghai', '雅帝星海', 'YA DI XINGHAI', 67, '高端私宅 · 艺术书房 · 当代美术馆'],
    ['xingkong', '雅帝星空', 'YA DI XINGKONG', 71, '高端私宅 · 影音室 · 艺术展厅'],
    ['yuanyin', '雅帝圆隐', 'YA DI YUANYIN', 75, '现代艺术 · 轻奢自然意象 · 高定私宅', 'assets/catalog/k80/products/yuanyin/front-b0020027.jpg'],
    ['zhuyu', '雅帝逐玉', 'YA DI ZHUYU', 79, '新中式 · 现代轻奢 · 高端会所'],
    ['xinlan', '雅帝馨澜', 'YA DI XINLAN', 83, '中式奢华 · 新古典 · 复古'],
    ['yiya', '雅帝意雅', 'YA DI YIYA', 87, '现代极简 · 侘寂风'],
    ['zhongya', '雅帝中雅', 'YA DI ZHONGYA', 91, '现代简约 · 自然轻奢 · 东方质感'],
    ['fengya', '雅帝风雅', 'YA DI FENGYA', 95, '现代极简 · 意式轻奢 · 原木新中式'],
    ['jianya', '雅帝简雅', 'YA DI JIANYA', 99, '现代简约 · 轻奢原木 · 工业风'],
    ['zhiya', '雅帝至雅', 'YA DI ZHIYA', 103, '现代雅致 · 轻奢极简 · 城市大平层'],
    ['tangya', '雅帝唐雅', 'YA DI TANGYA', 107, '现代轻奢 · 新中式 · 工业风'],
    ['songya', '雅帝宋雅', 'YA DI SONGYA', 111, '宋式极简 · 新中式宋韵 · 轻奢古雅'],
    ['songjie', '雅帝宋界', 'YA DI SONGJIE', 115, '宋式雅致 · 东方复古 · 新中式轻奢'],
    ['hanjie', '雅帝汉界', 'YA DI HANJIE', 119, '新中式 · 东方极简 · 轻奢禅意'],
    ['xinglvfu', '雅帝行律赋', 'YA DI XINGLVFU', 123, '现代极简 · 现代轻奢 · 工业风'],
    ['jintanfu', '雅帝锦檀赋', 'YA DI JINTANFU', 127, '现代简约 · 轻奢 · 极简住宅'],
    ['shuangyingfu', '雅帝双赢赋', 'YA DI SHUANGYINGFU', 131, '轻法式 · 新中式 · 古典'],
    ['jinlunfu', '雅帝金轮赋', 'YA DI JINLUNFU', 135, '新中式 · 东方禅意 · 高端改善型住宅'],
    ['jinghongfu', '雅帝荆虹赋', 'YA DI JINGHONGFU', 139, '新中式 · 高端轻奢 · 东方禅意', 'assets/catalog/k80/products/jinghong/front-b0012993.jpg'],
    ['jiangchuanfu', '雅帝江川赋', 'YA DI JIANGCHUANFU', 143, '现代东方 · 新中式轻奢 · 自然意境', 'assets/catalog/k80/products/jiangchuan/front-b0003064.jpg'],
    ['qinghuafu', '雅帝清华赋', 'YA DI QINGHUAFU', 147, '宋式雅致 · 东方复古 · 新中式轻奢'],
    ['yunlinfu', '雅帝云林赋', 'YA DI YUNLINFU', 151, '新中式 · 现代禅意 · 东方轻奢'],
    ['yixiangfu', '雅帝意象赋', 'YA DI YIXIANGFU', 155, '现代艺术 · 流动美学 · 当代大宅'],
    ['moyifu', '雅帝漠绎赋', 'YA DI MOYIFU', 159, '现代轻奢 · 自然侘寂 · 沙漠主题私宅'],
    ['yuechuan', '雅帝阅川', 'YA DI YUECHUAN', 163, '新中式 · 东方质感现代简约'],
    ['ruoyun', '雅帝若云', 'YA DI RUOYUN', 167, '传统中式 · 新中式大宅 · 中式轻奢'],
    ['longteng', '雅帝龙腾', 'YA DI LONGTENG', 171, '传统中式 · 新中式大宅 · 中式轻奢'],
    ['jiangyue', '雅帝江月', 'YA DI JIANGYUE', 175, '新中式 · 雅致轻奢 · 改善型家居'],
    ['cuican', '雅帝璀璨', 'YA DI CUICAN', 179, '高端住宅 · 改善型家居'],
    ['yanlan', '雅帝烟岚', 'YA DI YANLAN', 183, '新中式 · 东方当代 · 禅意风'],
    ['wangshan', '雅帝望山', 'YA DI WANGSHAN', 187, '新中式 · 东方意境 · 中式改善'],
    ['weilan', '雅帝微澜', 'YA DI WEILAN', 191, '现代东方 · 轻奢新中式 · 简约意境'],
    ['wenyi', '雅帝文漪', 'YA DI WENYI', 195, '现代文雅 · 轻奢新中式 · 当代大宅'],
    ['yuegui', '雅帝月归', 'YA DI YUEGUI', 199, '新中式 · 现代轻奢 · 极简住宅'],
    ['shanyun', '山韵门中门', 'SHAN YUN', 203, '新中式 · 东方简约 · 当代禅意'],
    ['yinglun', '雅帝英伦', 'YA DI YINGLUN', 207, '英伦复古 · 复古轻奢 · 新古典']
  ].map(([slug, name, latin, page, tags, cover]) => {
    const pdf = pdfCatalog[`k80:${slug}`] || {};
    return {
    slug, name, latin, series: 'k80', seriesLabel: '衡境 K80',
    tags, page,
    type: slug === 'yuanyin' ? '子母门原型 · 左小右大' : '对开门原型', thickness: '80 mm 全钢防盗结构',
    structure: '系统装甲门', frame: '2 mm 热镀锌钢板',
    casing: 'P40 门套', seal: 'EPDM 三元乙丙密封',
    hinge: '全钢精铸不锈钢五轴合页', hardware: 'YTZ81 智能拉手 + 08LM 护锁器',
    summary: `以${tags.split(' · ')[0]}为核心语汇，沿用 K80 的外平内开工艺和可组合饰面。`,
    ...pdf,
    cover: cover || pdf.gallery?.[0] || pdfPreview('k80', slug),
    gallery: [...(pdf.gallery || []), ...(pdf.sourceGallery || [])]
    };
  });

  const d90 = [
    ['jinqu', '金曲', 'JINQU', 217, '现代艺术 · 轻奢流动美学 · 当代高定私宅', 'assets/catalog/d90/products/jinqu/front-b0012605.jpg'],
    ['aige', '爱格', 'AIGE', 221, '欧式轻奢古典 · 现代古典混搭 · 法式质感', 'assets/catalog/d90/products/aige/front-b0019624.jpg'],
    ['songge', '颂歌', 'SONGGE', 225, '欧式轻奢古典 · 复古别墅 · 法式大平层', 'assets/catalog/d90/products/songge/front-b0020126.jpg'],
    ['yaozhen', '曜臻', 'YAOZHEN', 229, '现代极简艺术 · 自然肌理轻奢 · 通透私宅'],
    ['lansheng', '揽盛', 'LANSHENG', 233, '欧式复古轻奢 · 美式古典 · 现代复古'],
    ['lunyi', '沦漪', 'LUNYI', 237, '现代艺术 · 轻奢艺术空间 · 当代高定'],
    ['qionghua', '穹华', 'QIONGHUA', 241, '复古轻奢 · 现代古典 · 顶奢庄园'],
    ['shicui', '拾翠', 'SHICUI', 245, '复古轻奢 · 现代古典混搭 · 美式轻奢', 'assets/catalog/d90/products/shicui/front-b0020010.jpg'],
    ['shirui', '世瑞', 'SHIRUI', 249, '现代轻奢艺术 · 度假私宅 · 热带极简', 'assets/catalog/d90/products/shirui/front-b0019720.jpg'],
    ['yongshe', '永奢', 'YONGSHE', 253, '欧式复古 · 轻奢宫廷 · 新古典奢华'],
    ['guanmin', '冠冕', 'GUANMIAN', 257, '欧式宫廷 · 巴洛克复古 · 法式贵族', 'assets/catalog/d90/products/guanmin/front-b0020342.jpg'],
    ['yunjian', '蕴简', 'YUNJIAN', 261, '现代简约 · 自然侘寂 · 轻法自然'],
    ['manyu', '缦玉', 'MANYU', 265, '现代轻奢自然 · 极简肌理 · 高端私宅']
  ].map(([slug, name, latin, page, tags, cover]) => {
    const pdf = pdfCatalog[`d90:${slug}`] || {};
    return {
    slug, name, latin, series: 'd90', seriesLabel: '曜境 D90',
    tags, page,
    type: slug === 'shirui' ? '对开门原型 · 左侧整扇玻璃' : slug === 'jinqu' ? '单门 + 中庭边门原型' : '对开门原型', thickness: '90 mm 内全钢防盗结构',
    structure: '被动式系统门', frame: '6060-T66 超高强度铝合金型材',
    casing: 'D90 系统门套', seal: '海达 · 三元乙丙',
    hinge: '雅帝乐专属定制合页', hardware: '德国 KFV · 智能锁具',
    summary: `将${tags.split(' · ')[0]}的门面语言与 D90 被动式系统结构结合，按 PDF 原型展示。`,
    ...pdf,
    cover: cover || pdf.gallery?.[0] || pdfPreview('d90', slug),
    gallery: [...(pdf.gallery || []), ...(pdf.sourceGallery || [])]
    };
  });

  const products = [...k80, ...d90];
  const series = {
    k80: {
      key: 'k80', code: 'K80', name: '衡境', english: 'HENG · SYSTEM ARMORED DOOR',
      strap: '理性最优解', description: '无短板的均衡。以精密结构、稳定性能和自由饰面，回应长期居住的每一种需要。',
      hero: 'assets/catalog/k80/products/ruojian/front-b0019857.jpg',
      configure: 'door-lab.html?series=k80&v=20260813.35',
      stats: [['80 mm', '全钢防盗结构'], ['3 mm', '门扇与门框精密间隙'], ['150°', '宽角开启体验']],
      materials: ['ST 钢', 'AL 铝', 'CU 铜'], defaultProduct: 'ruojian'
    },
    d90: {
      key: 'd90', code: 'D90', name: '曜境', english: 'YAO · PASSIVE SYSTEM DOOR',
      strap: '极致不妥协', description: '无止境的臻曜。6060-T66 高性能铝型材、五腔断桥与 500 kg 性能五金，构成被动式系统门的完整秩序。',
      hero: 'assets/catalog/d90/products/shirui/front-b0019720.jpg',
      configure: 'door-lab.html?series=d90&v=20260813.35',
      stats: [['90 mm', '内全钢防盗结构'], ['6060-T66', '航空级铝型材'], ['500 kg', '性能五金系统']],
      materials: ['CNC 铝', '皇家白玉', '泰蓝织彩'], defaultProduct: 'shirui'
    }
  };

  const brand = {
    name: '雅帝乐', english: 'YADILO',
    motto: '雅境由心 · 帝韵相伴 · 乐享人生',
    intro: '浙江雅帝乐控股有限公司是一家集研发、设计、制造、销售于一体的综合型门企，产品涵盖入户门、别墅门、庭院门、保险柜与智能安防。',
    numbers: [['20+', '年产品研发经验'], ['800+', '专业员工'], ['31 万㎡', '两大智慧制造基地'], ['1000+', '全国专卖店']],
    values: ['安全', '精致', '尊贵']
  };

  window.YADILO_CATALOG = {
    brand, series, products,
    getProduct(seriesKey, slug) {
      return products.find((item) => item.series === seriesKey && item.slug === slug) || products.find((item) => item.series === seriesKey) || products[0];
    },
    getSeries(seriesKey) { return series[seriesKey] || series.k80; },
    bySeries(seriesKey) { return products.filter((item) => item.series === seriesKey); },
    cover(product) { return product?.cover || pdfPreview(product.series, product.page); }
  };
})();
