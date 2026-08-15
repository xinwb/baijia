const STORAGE_KEY = 'yadilo-personal-schemes-v2';
const MAX_SCHEMES = 24;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function compactScenes(aiScenes) {
  return clone(aiScenes).slice(0, 6).map((scene) => ({
    key: scene.key,
    status: scene.status || 'done',
    message: scene.message || '生成完成',
    generatedAt: scene.generatedAt || null,
    // A base64 image can be several megabytes and would make the personal
    // scheme impossible to restore from localStorage. Keep normal remote URLs
    // and small data URLs; large results remain visible in the current AI
    // drawer but are deliberately not copied into the scheme document.
    url: typeof scene.url === 'string' && (scene.url.startsWith('http') || scene.url.length < 180000) ? scene.url : ''
  }));
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `scheme-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn('[YADILO] 个人方案读取失败：', error);
    return [];
  }
}

function writeStorage(schemes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes.slice(0, MAX_SCHEMES)));
    return true;
  } catch (error) {
    console.warn('[YADILO] 个人方案保存失败：', error);
    return false;
  }
}

export function listSchemes() {
  return readStorage().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function getScheme(id) {
  return listSchemes().find((scheme) => scheme.id === id) || null;
}

export function createSchemeDocument({
  id,
  series,
  product,
  productLabel,
  config,
  orderPayload,
  aiScenes = [],
  title
}) {
  const existing = id ? getScheme(id) : null;
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: id || makeId(),
    title: title || `${series} · ${productLabel || product} · ${config?.typeLabel || '私人定制'}`,
    series,
    product,
    productLabel: productLabel || product,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    config: clone(config),
    orderPayload: clone(orderPayload),
    aiScenes: compactScenes(aiScenes)
  };
}

export function upsertScheme(scheme) {
  const current = readStorage();
  const normalized = {
    ...clone(scheme),
    schemaVersion: 2,
    id: scheme.id || makeId(),
    updatedAt: new Date().toISOString()
  };
  const index = current.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    normalized.createdAt = current[index].createdAt || normalized.createdAt;
    current.splice(index, 1);
  }
  current.unshift(normalized);
  writeStorage(current);
  // SQLite sync is best-effort. The local store remains authoritative for an
  // offline/static deployment, while the Python back office receives the same
  // scheme whenever the site is served through the admin server or proxy.
  fetch('./api/public/schemes', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalized)
  }).catch(() => {});
  window.dispatchEvent(new CustomEvent('yadilo:scheme-saved', { detail: normalized }));
  return normalized;
}

export function removeScheme(id) {
  const next = readStorage().filter((scheme) => scheme.id !== id);
  writeStorage(next);
  window.dispatchEvent(new CustomEvent('yadilo:scheme-removed', { detail: { id } }));
}

export function downloadScheme(scheme, filename = 'yadilo-personal-scheme.json') {
  const blob = new Blob([JSON.stringify(scheme, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatSchemeTime(value) {
  if (!value) return '未记录时间';
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch (error) {
    return value;
  }
}
