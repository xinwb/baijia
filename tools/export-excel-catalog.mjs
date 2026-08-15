import { FileBlob, SpreadsheetFile } from '/Users/wubin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
import { writeFile } from 'node:fs/promises';

const source = '/Users/wubin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wubin010745_34d6/temp/drag/门产品设计风格分类表0811.xlsx';
const destination = new URL('../excel-catalog.js', import.meta.url);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));

const SHEETS = [
  { name: 'K80AL铸铝门', series: 'k80', line: 'AL', label: 'K80 · 铸铝门' },
  { name: 'K80AL铸铝板', series: 'k80', line: 'AL', label: 'K80 · 铸铝板' },
  { name: 'K80ST钢制防盗门', series: 'k80', line: 'ST', label: 'K80 · 钢制防盗门' },
  { name: 'K80CU铜门', series: 'k80', line: 'CU', label: 'K80 · 铜门' },
  { name: 'K80WV', series: 'k80', line: 'WV', label: 'K80 · 木饰面' },
  { name: 'BDM-D90高端系统门', series: 'd90', line: 'D90', label: 'D90 · 高端系统门' },
  { name: '钢制背板', series: 'materials', line: 'BACK_STEEL', label: '背板 · 钢制' },
  { name: '木饰面', series: 'materials', line: 'BACK_WOOD', label: '背板 · 木饰面' },
  { name: '门墙一体', series: 'materials', line: 'WALL_DOOR', label: '墙体 · 门墙一体' },
  { name: '庭院门', series: 'materials', line: 'COURTYARD', label: '庭院门' }
];

const clean = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u00a0/g, ' ').trim();
};
const slugPart = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
const isMeaningful = (value) => clean(value) !== '';
const isWithdrawn = (value) => /下架|停产|取消/.test(clean(value));
const isCodeOnlyName = (value) => {
  const text = clean(value);
  return Boolean(text && !/[\u3400-\u9fff]/.test(text) && /^[a-z0-9\s-]+$/i.test(text));
};
const isLetterPrefixedName = (value) => /^[a-z]/i.test(clean(value));

const records = [];
for (const sheet of SHEETS) {
  const values = workbook.worksheets.getItem(sheet.name).getUsedRange().values || [];
  const headers = (values[0] || []).map(clean);
  values.slice(1).forEach((row, index) => {
    const parameters = {};
    headers.forEach((header, column) => {
      const value = clean(row[column]);
      if (header && value) parameters[header] = value;
    });
    const name = parameters['款式名称'] || parameters['名称'];
    if (!name) return;
    const remarks = parameters['备注'] || '';
    const style = parameters['设计风格'] || parameters['风格'] || '';
    const serial = parameters['序号'] || String(index + 1);
    const withdrawn = isWithdrawn(`${name} ${remarks}`);
    const isDoorRecord = sheet.series !== 'materials';
    const letterPrefixed = isDoorRecord && isLetterPrefixedName(name);
    const codeOnly = isDoorRecord && isCodeOnlyName(name);
    records.push({
      id: `${sheet.series}-${sheet.line.toLowerCase()}-${slugPart(serial)}-${index + 1}`,
      name,
      serial,
      series: sheet.series,
      line: sheet.line,
      lineLabel: sheet.label,
      style,
      remarks,
      active: !withdrawn && !letterPrefixed && !codeOnly,
      inactiveReason: withdrawn ? 'withdrawn' : letterPrefixed ? 'letter-prefix-name' : codeOnly ? 'code-only-name' : '',
      parameters,
      sourceSheet: sheet.name
    });
  });
}

const output = `/* Generated from 门产品设计风格分类表0811.xlsx. Do not hand-edit. */\nwindow.YADILO_EXCEL_CATALOG = ${JSON.stringify({
  source: '门产品设计风格分类表0811.xlsx',
  generatedAt: new Date().toISOString(),
  records
}, null, 2)};\n`;
await writeFile(destination, output, 'utf8');
console.log(`exported ${records.length} records to ${destination.pathname}`);
