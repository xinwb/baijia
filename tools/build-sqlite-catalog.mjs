#!/usr/bin/env node

/* Build the normalized catalog database from the files already used by the
 * configurators. The source payload is intentionally retained for fields that
 * still need manual normalization from the price guide. */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_DIR = path.join(ROOT, 'database');
const DB_PATH = path.join(DB_DIR, 'yadilo.sqlite');
const SCHEMA_PATH = path.join(DB_DIR, 'schema.sql');
const EXCEL_CATALOG_PATH = path.join(ROOT, 'excel-catalog.js');
const PRICE_GUIDE_PATH = path.join(ROOT, 'assets/source/docs/order-system/【官方指导价】雅帝乐官方报价指导手册.pdf');
const PRICE_TEXT_PATH = path.join(ROOT, 'tmp/price-guide.txt');

fs.mkdirSync(DB_DIR, { recursive: true });
fs.mkdirSync(path.dirname(PRICE_TEXT_PATH), { recursive: true });

function readExcelCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(EXCEL_CATALOG_PATH, 'utf8'), context, { filename: EXCEL_CATALOG_PATH });
  return context.window.YADILO_EXCEL_CATALOG.records;
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function checksum(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function firstNumber(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function allNumbers(value) {
  return [...String(value ?? '').replace(/,/g, '').matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function productKeyFor(record) {
  const nameHash = crypto.createHash('sha1').update(String(record.name || '')).digest('hex').slice(0, 10);
  return `${record.series || 'unknown'}-${record.line || 'catalog'}-${record.serial || 'na'}-${slug(record.name)}-${nameHash}`;
}

function sourceKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.pdf' ? 'pdf' : ext === '.xlsx' ? 'xlsx' : ext === '.xls' ? 'xls' : ext === '.js' ? 'js' : ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(ext) ? 'image' : 'other';
}

function addSource(db, filePath, title = null, metadata = {}) {
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(absolute)) return null;
  const file = relative(absolute);
  const row = db.prepare(`
    INSERT INTO source_documents (source_key, file_path, document_type, title, checksum, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      file_path = excluded.file_path,
      document_type = excluded.document_type,
      title = excluded.title,
      checksum = excluded.checksum,
      metadata_json = excluded.metadata_json,
      imported_at = CURRENT_TIMESTAMP
    RETURNING id
  `).get(file, file, sourceKind(absolute), title, checksum(absolute), json(metadata));
  return row.id;
}

function insertOrGetSeries(db, data) {
  db.prepare(`
    INSERT INTO product_series (code, name, line_label, description, active, source_document_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name, line_label = excluded.line_label,
      description = excluded.description, active = excluded.active,
      source_document_id = excluded.source_document_id
  `).run(data.code, data.name, data.lineLabel, data.description, data.active ? 1 : 0, data.sourceDocumentId);
  return db.prepare('SELECT id FROM product_series WHERE code = ?').get(data.code).id;
}

function insertProduct(db, data) {
  db.prepare(`
    INSERT INTO products (product_key, name, english_name, series_id, catalog_serial, style, line_code, active, configurator_key, thumbnail_path, source_payload, source_document_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_key) DO UPDATE SET
      name = excluded.name, english_name = excluded.english_name, series_id = excluded.series_id,
      catalog_serial = excluded.catalog_serial, style = excluded.style, line_code = excluded.line_code,
      active = excluded.active, configurator_key = excluded.configurator_key,
      thumbnail_path = excluded.thumbnail_path, source_payload = excluded.source_payload,
      source_document_id = excluded.source_document_id, updated_at = CURRENT_TIMESTAMP
  `).run(
    data.productKey, data.name, data.englishName, data.seriesId, data.catalogSerial, data.style,
    data.lineCode, data.active ? 1 : 0, data.configuratorKey, data.thumbnailPath,
    json(data.sourcePayload), data.sourceDocumentId
  );
  return db.prepare('SELECT id FROM products WHERE product_key = ?').get(data.productKey).id;
}

function insertAttribute(db, productId, key, value, sourceDocumentId) {
  const text = value == null ? null : String(value);
  const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : (typeof value === 'object' ? 'json' : 'text');
  db.prepare(`
    INSERT INTO product_attributes (product_id, attribute_key, attribute_value, value_type, source_document_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(product_id, attribute_key) DO UPDATE SET
      attribute_value = excluded.attribute_value, value_type = excluded.value_type,
      source_document_id = excluded.source_document_id
  `).run(productId, key, typeof value === 'object' ? json(value) : text, type, sourceDocumentId);
}

function seedDoorTypes(db) {
  const types = [
    ['single', '单门', 900, 1000, 1300, 2200, 2400, 3000, 1, '单扇门体'],
    ['mother', '子母门', 1100, 1300, 1700, 2300, 2600, 3100, .66, '左窄右宽的双扇门体'],
    ['double', '对开门', 1800, 2100, 2400, 2300, 2600, 3200, .5, '左右对称双扇门体'],
    ['sideLight', '单边边门', 1600, 1900, 2300, 2300, 2600, 3100, 1, '主门加单侧边门/边光'],
    ['doubleSide', '双边边门', 2400, 3000, 3600, 2300, 2600, 3200, .5, '主门两侧配置边门/边光']
  ];
  for (const row of types) {
    db.prepare(`
      INSERT INTO door_types (code, name, width_min_mm, width_default_mm, width_max_mm, height_min_mm, height_default_mm, height_max_mm, leaf_ratio, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET name=excluded.name, width_min_mm=excluded.width_min_mm,
        width_default_mm=excluded.width_default_mm, width_max_mm=excluded.width_max_mm,
        height_min_mm=excluded.height_min_mm, height_default_mm=excluded.height_default_mm,
        height_max_mm=excluded.height_max_mm, leaf_ratio=excluded.leaf_ratio, description=excluded.description
    `).run(...row);
  }
  return Object.fromEntries(db.prepare('SELECT code, id FROM door_types').all().map((row) => [row.code, row.id]));
}

function seedOptionGroups(db) {
  const groups = [
    ['color', '产品颜色', 'single', 0, 10],
    ['texture_variant', '纹理方案', 'single', 0, 20],
    ['texture_surface', '纹理表面', 'single', 0, 21],
    ['transom', '气窗', 'single', 0, 30],
    ['transom_type', '气窗类型', 'single', 0, 31],
    ['lock', '锁具', 'single', 0, 40],
    ['handle', '拉手', 'single', 0, 41],
    ['frame', '门框', 'single', 0, 50],
    ['casing', '门套', 'single', 0, 60],
    ['hinge', '合页', 'single', 0, 70],
    ['opening', '开门方向', 'single', 0, 80],
    ['frame_build', '门框工艺', 'single', 0, 90],
    ['frame_install', '门框安装位置', 'single', 0, 91]
  ];
  for (const row of groups) db.prepare(`
    INSERT INTO option_groups (code, name, selection_mode, required, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name=excluded.name, selection_mode=excluded.selection_mode, required=excluded.required, sort_order=excluded.sort_order
  `).run(...row);
  return Object.fromEntries(db.prepare('SELECT code, id FROM option_groups').all().map((row) => [row.code, row.id]));
}

function seedOptions(db, groups) {
  const definitions = {
    color: [
      ['factory-brass', '花絮黄铜 13#', '产品原厂色', 0, 'each'], ['deep-bronze', '深古铜', '深色金属工艺', 0, 'each'], ['antique-gold', '旧金', '复古金属工艺', 0, 'each'], ['graphite', '石墨灰', '深灰色工艺', 0, 'each'], ['champagne-gold', '香槟金', '暖金色工艺', 0, 'each'], ['beige-gray', '米灰色', '独立米灰纹理', 0, 'each'],
      ['bmw-gray', '宝马灰', '产品原厂色', 0, 'each'], ['brass-11', '花絮黄铜 11#', '产品原厂色', 0, 'each'], ['blue-8', '泰蓝织彩 8#', '产品原厂色', 0, 'each'], ['warm-brass', '暖黄铜', '产品原厂色', 0, 'each'], ['black', '雅黑', '产品原厂色', 0, 'each'], ['gloss-black', '炫光黑', '产品原厂色', 0, 'each'], ['green-bronze', '青古铜', '产品原厂色', 0, 'each'], ['titanium', '钛灰', '产品原厂色', 0, 'each'], ['brass-13', '花繁黄铜 13#', '产品原厂色', 0, 'each'], ['yingmu', '影木 1#', '产品原厂色', 0, 'each'], ['oak', '美洲橡木 1#', '产品原厂色', 0, 'each'], ['bronze', '花絮深古铜 1#', '产品原厂色', 0, 'each'], ['silver', '银灰', '产品原厂色', 0, 'each'], ['champagne', '香槟铜', '产品原厂色', 0, 'each'], ['ink-gold', '墨金', '产品原厂色', 0, 'each'], ['original', '原始工艺色', '产品原厂色', 0, 'each'], ['ink-green', '墨绿雨花点', '产品原厂色', 0, 'each'], ['deep-green', '深墨绿', '产品原厂色', 0, 'each']
    ],
    texture_variant: [['factory', '原厂纹理', '保持实拍金属反射', 0, 'each'], ['relief', '浮雕强化', '增强凹凸与细纹层次', 0, 'each'], ['matte', '哑光拉丝', '降低高光', 0, 'each']],
    texture_surface: [['factory', '原厂实拍', '保留本款完整纹理', 0, 'each'], ['graphite', '深钛灰肌理', '强化纵向拉丝与凹凸', 0, 'each'], ['bronze', '暖古铜肌理', '保留浮雕的铜色层次', 0, 'each'], ['titanium', '雾银钛肌理', '提亮金属反射与细纹', 0, 'each']],
    transom: [['none', '无气窗', '完整门体', 0, 'each'], ['door-extended', '有气窗', '门体增加高度', 0, 'each'], ['square-true', '方形真气窗', '独立玻璃气窗', 0, 'each'], ['integrated', '门窗一体', '门扇与气窗一体', 0, 'each']],
    transom_type: [['same-texture', '同色纹理气窗', '沿用产品纹理', 0, 'each'], ['frosted', '长虹夹胶气窗', '暗色夹胶采光', 90000, 'each'], ['grille', '金属格栅气窗', '同色格栅半透', 120000, 'each']],
    lock: [['none', '隐藏锁体', '无外露面板', 0, 'each'], ['smart', '智能锁', '电子锁体', 0, 'each'], ['yt82', 'YT82 圆形锁', '圆形锁体', 0, 'each'], ['08', '08 型电子锁体', '报价按锁具表核价', 0, 'each'], ['07', '07 型机械锁体', '报价按锁具表核价', 0, 'each']],
    handle: [['none', '无外拉手', '仅保留锁体', 0, 'each'], ['long', 'SL48F 通天拉手', '竖向长拉手', 80000, 'each'], ['sl48d', 'SL48D 通天权杖拉手', '竖向长拉手', 140000, 'each'], ['ring', '环形拉手', '圆环拉手', 0, 'each'], ['integrated', '纹理一体灯带拉手', '融入门扇纹理', 0, 'each']],
    frame: [['narrow-black', '极窄黑门框', '哑光金属门框', 0, 'each'], ['brushed-gold', '香槟金门框', '细腻拉丝门框', 60000, 'each'], ['same-color', '同色门框', '与门扇一体', 80000, 'each']],
    casing: [['p40', 'P40 型门套', '厚型收口', 120000, 'each'], ['wl3k', 'WL3K 型门套', '窄边收口', 90000, 'each'], ['z', 'Z 型门套', '极简收口', 70000, 'each'], ['d90mt-f', 'D90MT-F', 'D90 门套，按米计价', 48000, 'meter'], ['wk', 'WK 门套', '按米计价', 28000, 'meter']],
    hinge: [['d90-hidden', 'D90 标配暗合页', '隐藏合页', 0, 'each'], ['d90-heavy', 'D90 重载外合页', '重载外合页', 0, 'each'], ['k80-hidden', 'K80 单轴暗合页', '隐藏合页', 0, 'each'], ['k80-five-axis', 'K80 全钢五轴', '全钢五轴合页', 0, 'each'], ['k80-external', 'K80 重载外合页', '重载外合页', 0, 'each']],
    opening: [['out-left', '外开左锁', '左侧锁具', 0, 'each'], ['out-right', '外开右锁', '右侧锁具', 0, 'each'], ['in-left', '内开左锁', '左侧锁具', 0, 'each'], ['in-right', '内开右锁', '右侧锁具', 0, 'each']],
    frame_build: [['integral', '整体制作', '现场一体安装', 0, 'each'], ['assembled', '拼装制作', '分体安装', 0, 'each']],
    frame_install: [['outside', '靠墙外', '相对墙体的落位', 0, 'each'], ['center', '靠中装', '相对墙体的落位', 0, 'each'], ['inside', '靠墙内', '相对墙体的落位', 0, 'each']]
  };
  const optionIds = {};
  for (const [groupCode, rows] of Object.entries(definitions)) {
    optionIds[groupCode] = {};
    for (const [key, name, note, priceCents, unit] of rows) {
      db.prepare(`
        INSERT INTO options (option_group_id, option_key, name, note, price_cents, unit)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(option_group_id, option_key) DO UPDATE SET name=excluded.name, note=excluded.note, price_cents=excluded.price_cents, unit=excluded.unit
      `).run(groups[groupCode], key, name, note, priceCents, unit);
      optionIds[groupCode][key] = db.prepare('SELECT id FROM options WHERE option_group_id = ? AND option_key = ?').get(groups[groupCode], key).id;
    }
  }
  return optionIds;
}

const CONFIG_KEYS = {
  '雅帝若简': { key: 'ruojian', types: ['single', 'mother', 'double'], defaultType: 'mother' },
  '雅帝圆隐': { key: 'yuanyin', types: ['single', 'mother', 'double'], defaultType: 'mother' },
  '雅帝江川赋': { key: 'jiangchuan', types: ['single', 'mother', 'double'], defaultType: 'double' },
  '雅帝荆虹赋': { key: 'jinghong', types: ['single', 'mother', 'double'], defaultType: 'double' },
  '雅帝清华赋': { key: 'qinghuafu', types: ['single', 'mother', 'double'], defaultType: 'double' },
  // The D90 configurator key `jinqu` is the PDF product "金曲". The Excel
  // source calls the same catalogue row "金曲岩板"; keep that source name,
  // but never attach the key to the separate "缦玉" product.
  '金曲岩板': { key: 'jinqu', types: ['sideLight'], defaultType: 'sideLight' },
  '世瑞黄铜门联窗': { key: 'shirui', types: ['double'], defaultType: 'double' },
  '拾翠薄铝': { key: 'shicui', types: ['double'], defaultType: 'double' },
  '爱格铝板': { key: 'aige', types: ['double'], defaultType: 'double' },
  '颂歌20mm精雕': { key: 'songge', types: ['double'], defaultType: 'double' },
  '冠冕铸铜': { key: 'guanmin', types: ['double'], defaultType: 'double' }
};

const CONFIG_DIMENSIONS = {
  d90: {
    sideLight: [1600, 1900, 2300, 2300, 2600, 3100],
    double: [1700, 1800, 2200, 3000, 3500, 4000]
  },
  k80: {
    single: [900, 1000, 1300, 2200, 2400, 3000], mother: [1100, 1300, 1700, 2300, 2600, 3100], double: [1800, 2100, 2400, 2300, 2600, 3200]
  }
};

function seedConfig(db, seriesByCode, doorTypes, optionIds) {
  const products = db.prepare('SELECT id, product_key, name, series_id FROM products').all();
  const typeRows = Object.fromEntries(Object.entries(doorTypes).map(([code, id]) => [code, id]));
  for (const product of products) {
    const config = CONFIG_KEYS[product.name];
    if (!config) continue;
    const series = db.prepare('SELECT code FROM product_series WHERE id = ?').get(product.series_id).code;
    for (const type of config.types) {
      db.prepare(`INSERT OR IGNORE INTO product_door_types (product_id, door_type_id, is_default) VALUES (?, ?, ?)`)
        .run(product.id, typeRows[type], type === config.defaultType ? 1 : 0);
      const dims = CONFIG_DIMENSIONS[series]?.[type];
      if (dims) db.prepare(`
        INSERT INTO dimension_rules (product_id, door_type_id, width_min_mm, width_default_mm, width_max_mm, height_min_mm, height_default_mm, height_max_mm, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(product.id, typeRows[type], ...dims, '来自当前配置器门型范围；后续可用订单系统规则覆盖');
    }
    const defaults = {
      color: series === 'd90' ? 'factory-brass' : 'champagne-gold',
      texture_variant: 'factory', transom: 'none', lock: 'none', handle: 'none', frame: 'same-color', casing: 'p40'
    };
    for (const [group, key] of Object.entries(defaults)) {
      const optionId = optionIds[group]?.[key];
      if (!optionId) continue;
      db.prepare(`INSERT OR IGNORE INTO product_options (product_id, option_id, is_default) VALUES (?, ?, 1)`).run(product.id, optionId);
      for (const type of config.types) db.prepare(`INSERT OR IGNORE INTO product_door_type_options (product_id, door_type_id, option_id) VALUES (?, ?, ?)`).run(product.id, typeRows[type], optionId);
    }
    const available = series === 'd90'
      ? (config.key === 'songge' || config.key === 'guanmin' ? ['none', 'smart', 'yt82'] : ['none', 'smart'])
      : ['none', 'smart', '07', '08'];
    for (const key of available) {
      const optionId = optionIds.lock?.[key];
      if (!optionId) continue;
      db.prepare(`INSERT OR IGNORE INTO product_options (product_id, option_id) VALUES (?, ?)`).run(product.id, optionId);
      for (const type of config.types) db.prepare(`INSERT OR IGNORE INTO product_door_type_options (product_id, door_type_id, option_id) VALUES (?, ?, ?)`).run(product.id, typeRows[type], optionId);
    }
    const handles = {
      shicui: ['none', 'integrated'],
      aige: ['none', 'long', 'ring'],
      songge: ['none', 'ring'],
      guanmin: ['none', 'long']
    }[config.key] || ['none'];
    for (const key of handles) {
      const optionId = optionIds.handle?.[key];
      if (!optionId) continue;
      const isDefault = (config.key === 'aige' && key === 'long') || (config.key === 'songge' && key === 'ring') || (config.key === 'guanmin' && key === 'long');
      db.prepare(`INSERT OR IGNORE INTO product_options (product_id, option_id, is_default) VALUES (?, ?, ?)`).run(product.id, optionId, isDefault ? 1 : 0);
      for (const type of config.types) db.prepare(`INSERT OR IGNORE INTO product_door_type_options (product_id, door_type_id, option_id) VALUES (?, ?, ?)`).run(product.id, typeRows[type], optionId);
    }
    if (config.key === 'guanmin') {
      insertAttribute(db, product.id, 'modeling_rule', '完整拱形双扇门；拱顶、浮雕和宝石饰件随门扇一体开启', null);
      insertAttribute(db, product.id, 'fixed_transom_mm', 0, null);
    }
    db.prepare('UPDATE products SET configurator_key = ? WHERE id = ?').run(config.key, product.id);
  }
}

function importPdf(db, sourceDocumentId) {
  try {
    execFileSync('pdftotext', ['-layout', PRICE_GUIDE_PATH, PRICE_TEXT_PATH], { stdio: 'ignore' });
  } catch (error) {
    console.warn('pdftotext unavailable; PDF source metadata was still recorded.');
    return;
  }
  const pages = fs.readFileSync(PRICE_TEXT_PATH, 'utf8').split('\f');
  for (let index = 0; index < pages.length; index += 1) {
    const raw = pages[index].trim();
    if (!raw || !/(报价|价格|K80|D90|锁具|拉手|门套|门框|气窗)/i.test(raw)) continue;
    const category = /锁具/.test(raw) ? 'lock' : /拉手/.test(raw) ? 'handle' : /门套/.test(raw) ? 'casing' : /D90/.test(raw) ? 'd90' : /K80/.test(raw) ? 'k80' : 'price';
    db.prepare(`INSERT INTO price_references (source_document_id, section_title, page_start, page_end, category, raw_text) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(sourceDocumentId, raw.split('\n').find(Boolean)?.slice(0, 120) || null, index + 1, index + 1, category, raw);
  }
}

function importExcelPrices(db, records, sourceDocumentId) {
  const priceInsert = db.prepare(`INSERT INTO price_rules (product_id, price_kind, amount_cents, unit, notes, source_document_id, source_locator) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const officialFallbacks = {
    '雅帝圆隐': { base: [5200], finish: [5160], note: '官方报价手册 K80 第45款' },
    '金曲岩板': { finish: [6000], note: '官方报价指导手册 D90 第9款金曲' },
    '爱格铝板': { finish: [14960], note: '官方报价指导手册 D90 第5款爱格' },
    '拾翠薄铝': { finish: [6760], note: '官方报价指导手册 D90 第6款拾翠' },
    '冠冕铸铜': { finish: [39200], note: '官方报价指导手册 D90 第7款冠冕' },
    '世瑞黄铜门联窗': { finish: [11200], note: '官方报价指导手册 D90 第10款世瑞' },
    '颂歌20mm精雕': { finish: [14400], note: '官方报价指导手册 D90 第11款颂歌' }
  };
  for (const record of records) {
    const product = db.prepare('SELECT id FROM products WHERE product_key = ?').get(productKeyFor(record));
    if (!product) continue;
    const base = allNumbers(record.parameters?.['基础平方价（元/㎡）']);
    for (const amount of base) priceInsert.run(product.id, 'base_area', Math.round(amount * 100), 'sqm', 'Excel 目录基础平方价', sourceDocumentId, record.sourceSheet);
    const finish = allNumbers(record.parameters?.['饰面板价（元/㎡）']);
    for (const amount of finish) priceInsert.run(product.id, 'finish_area', Math.round(amount * 100), 'sqm', 'Excel 目录饰面板价', sourceDocumentId, record.sourceSheet);
    const fallback = officialFallbacks[record.name];
    if (fallback && !base.length && fallback.base) for (const amount of fallback.base) priceInsert.run(product.id, 'base_area', Math.round(amount * 100), 'sqm', fallback.note, sourceDocumentId, '官方报价手册');
    if (fallback && !finish.length && fallback.finish) for (const amount of fallback.finish) priceInsert.run(product.id, 'finish_area', Math.round(amount * 100), 'sqm', fallback.note, sourceDocumentId, '官方报价手册');
  }
}

function importAssets(db, productByName) {
  const roots = ['assets/catalog/d90/products', 'assets/catalog/k80/products', 'assets/generated/series/d90/textures', 'assets/generated/series/k80/textures'];
  const files = [];
  for (const root of roots) {
    const absolute = path.join(ROOT, root);
    if (!fs.existsSync(absolute)) continue;
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full); else if (/\.(jpg|jpeg|png|webp|svg)$/i.test(entry.name)) files.push(full);
      }
    };
    walk(absolute);
  }
  const insert = db.prepare(`INSERT INTO asset_references (product_id, asset_role, file_path, is_primary) VALUES (?, ?, ?, ?)`);
  for (const file of files) {
    const lower = file.toLowerCase();
    const product = Object.entries(productByName).find(([name]) => lower.includes(slug(name)));
    if (!product) continue;
    const productId = product[1];
    const role = /front|product/.test(lower) ? 'front' : /detail/.test(lower) ? 'detail' : /texture/.test(lower) ? 'texture' : 'asset';
    insert.run(productId, role, relative(file), role === 'front' ? 1 : 0);
  }
}

function main() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`DELETE FROM asset_references; DELETE FROM price_references; DELETE FROM price_rules; DELETE FROM product_door_type_options; DELETE FROM dimension_rules; DELETE FROM product_options; DELETE FROM product_door_types; DELETE FROM product_attributes; DELETE FROM products; DELETE FROM product_series; DELETE FROM source_documents;`);
  const importRun = db.prepare(`INSERT INTO import_runs (status, notes) VALUES ('running', ?) RETURNING id`).get('Excel 目录 + 前端配置 + 官方报价手册初始化').id;
  const excelSource = addSource(db, EXCEL_CATALOG_PATH, '门产品设计风格分类表0811.xlsx（已生成目录）');
  const xlsxSource = addSource(db, 'assets/source/docs/order-system/order-rules/K80对开页面驱动配置xhh(1).xlsx', 'K80 对开页面驱动配置');
  const xlsSource = addSource(db, 'assets/source/docs/order-system/order-rules/K80对开字段信息(1).xls', 'K80 对开字段信息');
  const pdfSource = addSource(db, PRICE_GUIDE_PATH, '2026 雅帝乐官方报价指导手册', { pages: 219 });
  addSource(db, 'd90-configurator.js', 'D90 配置器产品与选配规则');
  addSource(db, 'glb-configurator.js', 'K80 配置器产品与选配规则');
  addSource(db, 'assets/catalog/door-textures.json', '门体纹理清单');
  const records = readExcelCatalog();
  const seriesInfo = {
    k80: ['k80', 'K80', 'K80 产品', true], d90: ['d90', 'D90', 'D90 高端系统门', true], materials: ['materials', '材料及其他门类', '背板、门墙一体、庭院门等目录项', true]
  };
  const seriesByCode = {};
  for (const [code, [, name, description, active]] of Object.entries(seriesInfo)) seriesByCode[code] = insertOrGetSeries(db, { code, name, lineLabel: name, description, active, sourceDocumentId: excelSource });
  const productByName = {};
  for (const record of records) {
    const seriesId = seriesByCode[record.series] || seriesByCode.materials;
    const productId = insertProduct(db, {
      productKey: productKeyFor(record), name: record.name, englishName: null, seriesId,
      catalogSerial: record.serial, style: record.style, lineCode: record.line, active: record.active,
      configuratorKey: CONFIG_KEYS[record.name]?.key || null, thumbnailPath: null,
      sourcePayload: record, sourceDocumentId: excelSource
    });
    productByName[record.name] = productId;
    for (const [key, value] of Object.entries(record.parameters || {})) insertAttribute(db, productId, key, value, excelSource);
  }
  const doorTypes = seedDoorTypes(db);
  const optionGroups = seedOptionGroups(db);
  const optionIds = seedOptions(db, optionGroups);
  seedConfig(db, seriesByCode, doorTypes, optionIds);
  importExcelPrices(db, records, excelSource);
  importPdf(db, pdfSource);
  importAssets(db, productByName);
  db.prepare(`UPDATE import_runs SET completed_at = CURRENT_TIMESTAMP, status = 'completed', source_count = ? WHERE id = ?`).run(records.length, importRun);
  const summary = {
    database: relative(DB_PATH), products: db.prepare('SELECT COUNT(*) AS count FROM products').get().count,
    activeProducts: db.prepare('SELECT COUNT(*) AS count FROM products WHERE active = 1').get().count,
    series: db.prepare('SELECT COUNT(*) AS count FROM product_series').get().count,
    options: db.prepare('SELECT COUNT(*) AS count FROM options').get().count,
    dimensionRules: db.prepare('SELECT COUNT(*) AS count FROM dimension_rules').get().count,
    priceRules: db.prepare('SELECT COUNT(*) AS count FROM price_rules').get().count,
    priceReferences: db.prepare('SELECT COUNT(*) AS count FROM price_references').get().count,
    assets: db.prepare('SELECT COUNT(*) AS count FROM asset_references').get().count
  };
  db.close();
  console.log(JSON.stringify(summary, null, 2));
}

main();
