const TYPE_VALUES = { single: '3729', mother: '3730', double: '3731', sideLight: '3731' };
const OPENING_VALUES = { 'out-left': '490', 'out-right': '491', 'in-left': '492', 'in-right': '493' };
const K80_PRODUCT_VALUES = { ruojian: '7086', jiangchuan: '7087', jinghong: '7095', yuanyin: '7124' };
const HINGE_VALUES = { 'k80-hidden': '7355', 'k80-five-axis': '7005', 'k80-external': '7329', 'd90-hidden': null, 'd90-heavy': null };
const K80_HINGE_LABELS = { 'k80-hidden': 'K80 单轴暗合页', 'k80-five-axis': 'K80 全钢精铸不锈钢五轴合页', 'k80-external': 'K80 外合页' };

function field(value, label = '') {
  return { value: value == null ? '' : String(value), label };
}

export function buildOrderPayload({ series, product, productLabel, typeLabel, colorLabel, backColorLabel, state }) {
  const isK80 = series === 'K80';
  const surfaceSeriesValue = { K80AL: '7356', K80ST: '7357', K80CU: '7358' }[state.surfaceSeries] || state.surfaceSeries || '7356';
  const backMaterialValue = { '热镀锌钢板': '4485', '背面钢板': '4485', '铝板': '4486', '铜板': '4487', '木饰面': '4488' }[state.backMaterial] || state.backMaterial || '4485';
  const topWindowType = state.transomType === 'square-glass' ? '方型玻璃气窗'
    : state.transomType === 'square-true' ? '方形实体'
      : state.transomType === 'round-glass' ? '圆弧玻璃'
        : state.transomType === 'round-true' ? '圆弧实体' : '';
  const fields = {
    door_template_id: field(isK80 ? '411' : '', isK80 ? '对开标准下单模板' : '待绑定 D90 订单模板'),
    door_template_name: field(`${series} · ${productLabel}`),
    series: field(series),
    catalog_product: field(product, productLabel),
    MTGY_ZQJ: field(isK80 ? surfaceSeriesValue : '', isK80 ? (state.surfaceSeries || 'K80AL') : 'D90 工艺待映射'),
    xhh_door_model: field(TYPE_VALUES[state.type], typeLabel),
    front_design_main: field(isK80 ? K80_PRODUCT_VALUES[product] || product : product, productLabel),
    back_design_main: field(isK80 ? K80_PRODUCT_VALUES[product] || product : product, `${productLabel} · 背面`),
    menxingjigou: field(backMaterialValue, state.backMaterial || '背面钢板'),
    front_material: field(state.frontMaterial, '正面材质'),
    front_panel_thickness: field(state.frontThickness, '正面板厚 mm'),
    front_finish_process: field(state.frontProcess, '正面表面工艺'),
    front_texture: field(state.frontTextureLabel, '正面材质纹理'),
    back_material: field(state.backMaterial, '背面材质'),
    back_panel_thickness: field(state.backThickness, '背面板厚 mm'),
    back_finish_process: field(state.backProcess, '背面表面工艺'),
    back_texture: field(state.backTextureLabel, '背面材质纹理'),
    color: field(state.frontColor, colorLabel),
    rear_panel_color: field(state.backColor, backColorLabel),
    open_direction: field(OPENING_VALUES[state.opening], state.opening),
    top_window: field(state.transom ? state.transomType : '47', state.transom ? state.transomType : '无气窗'),
    top_window_type: field(topWindowType, topWindowType || '无'),
    top_window_flower: field(state.transomFlowerEnabled ? '1' : '0', state.transomFlowerEnabled ? '气窗花件' : '无花件'),
    top_window_flower_material: field(state.transomMainMaterial, '主花件材质'),
    top_window_flower_thickness: field(state.transomMainThickness, '主花件厚度 mm'),
    top_window_flower_process: field(state.transomMainProcess, '主花件工艺'),
    top_window_branch_style: field(state.transomSecondaryStyle, '花枝 / 花枝夹玻璃'),
    top_window_branch_thickness: field(state.transomSecondaryThickness, '花枝厚度 mm'),
    top_window_branch_process: field(state.transomSecondaryProcess, '花枝工艺'),
    top_window_outer_glass: field(state.transomOuterGlass, '外侧玻璃'),
    top_window_outer_glass_thickness: field(state.transomOuterGlassThickness, '外侧玻璃厚度'),
    top_window_inner_glass: field(state.transomInnerGlass, '内侧玻璃'),
    top_window_inner_glass_thickness: field(state.transomInnerGlassThickness, '内侧玻璃厚度'),
    hinge: field(HINGE_VALUES[state.hinge], K80_HINGE_LABELS[state.hinge] || state.hinge),
    width: field(state.width, '包框宽'),
    height: field(state.height, '包框高'),
    width2: field(Math.max(0, state.width - (isK80 ? 162 : 164)), '见光宽'),
    height2: field(Math.max(0, state.height - (isK80 ? 117 : 127)), '见光高'),
    total_height: field(state.height, '包框高（含气窗）'),
    width1: field(state.width + (isK80 ? 120 : 132), '外门套总宽'),
    height1: field(state.height + (isK80 ? 60 : 66), '外门套总高'),
    wall_thickness: field(state.wallThickness, '总墙厚'),
    outer_casing: field(state.outerCasing, '外门套形式'),
    outer_casing_color: field(state.outerCasingColor, '外门套色板'),
    inner_casing: field(state.innerCasing, '内门套形式'),
    inner_casing_color: field(state.innerCasingColor, '内门套色板'),
    frame_profile: field(state.frameProfile, '门框形式'),
    frame_color: field(state.frameColor, '门框色板'),
    threshold: field(state.threshold, '底槛'),
    threshold_note: field(state.thresholdNote, '底槛备注'),
    mk_fenweideng_xhh: field(state.frameAtmosphereLightEnabled ? '1' : '0', state.frameAtmosphereLightEnabled ? '门框氛围灯' : '无门框氛围灯'),
    threshold_atmosphere_light: field(state.thresholdLightEnabled ? '1' : '0', state.thresholdLightEnabled ? '底槛氛围灯' : '无底槛氛围灯'),
    threshold_drainage: field(state.thresholdDrainEnabled ? '1' : '0', state.thresholdDrainEnabled ? '底槛排水槽' : '无底槛排水槽'),
    wall_integrated: field(state.wallIntegrated, '门墙一体'),
    wall_module: field(state.wallModule, '墙面模块'),
    wall_light: field(state.wallLightEnabled ? '1' : '0', state.wallLightEnabled ? '墙面氛围灯' : '无墙面氛围灯'),
    qhfx_zqj: field(state.frameInstall, '门框安装位置'),
    xhh_mkzzfs: field(state.frameBuild, '门框制作方式'),
    locks: field(state.lockPanelCode || state.lock, state.lockPanelCode || '锁具'),
    lock_body: field(state.lock, '锁体类型'),
    handle_style: field(state.handleCode || state.handle, state.handleCode || '执手'),
    seal: field(state.sealCode, '密封条'),
    Fenweideng: field(state.integratedLightEnabled ? '1' : '0', state.integratedLightEnabled ? '门体结构灯带' : '关闭门体结构灯带'),
    Outer_handle: field(state.handleCode || state.handle, '外配拉手'),
    handle_offset_x_mm: field(state.handleOffsetXMm, '拉手左右偏移'),
    handle_offset_y_mm: field(state.handleOffsetMm, '拉手上下偏移'),
    handle_scale: field(state.handleScale, '拉手缩放'),
    lock_offset_x_mm: field(state.lockOffsetXMm, '锁体左右偏移'),
    lock_offset_y_mm: field(state.lockOffsetMm, '锁体上下偏移'),
    lock_scale: field(state.lockScale, '锁体缩放'),
    texture_zoom: field(state.textureZoom, '纹理缩放'),
    texture_pan_x: field(state.texturePanX, '纹理左右取景'),
    texture_pan_y: field(state.texturePanY, '纹理上下取景'),
    surface_series: field(state.surfaceSeries, 'K80 门体工艺')
  };
  return {
    platform: 'DepLS_YADILO',
    endpoint: '/DepLS_YADILO/preOrderDynamic/save',
    templateId: fields.door_template_id.value || null,
    readyForMapping: true,
    unmapped: isK80 ? [] : ['door_template_id', 'hinge'],
    fields
  };
}
