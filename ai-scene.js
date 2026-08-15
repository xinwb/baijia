const SCENE_PRESETS = [
  {
    key: 'arrival',
    title: '现代别墅入口',
    tag: '日间 · 建筑立面',
    prompt: '现代别墅入口，浅灰石材与温暖木饰面，门体正面为画面主体，建筑摄影，柔和日间侧光，真实比例。'
  },
  {
    key: 'courtyard',
    title: '庭院迎宾空间',
    tag: '黄昏 · 庭院',
    prompt: '高端私宅庭院入口，低矮景观、石材台阶与克制的植物，黄昏暖光，门体细节清晰，真实室外建筑摄影。'
  },
  {
    key: 'minimal',
    title: '极简门厅',
    tag: '室内 · 画廊光线',
    prompt: '极简高端住宅门厅，微水泥墙面、天然石材地面、隐藏灯带与少量家具，干净画廊式构图，真实材质反射。'
  },
  {
    key: 'night',
    title: '夜间灯光方案',
    tag: '夜景 · 氛围照明',
    prompt: '高端别墅夜间入口，门体周围有克制的线性壁灯和地面洗墙光，深色建筑背景，门锁与金属表面反射清楚，真实夜景摄影。'
  }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function imageUrlFromResponse(data) {
  const item = data?.data?.[0] || data?.images?.[0] || data?.result?.[0] || data?.result;
  if (typeof item === 'string') return item;
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.base64) return `data:image/png;base64,${item.base64}`;
  return '';
}

function compactSnapshot(snapshot) {
  return JSON.stringify(snapshot, (key, value) => {
    if (['aiScenes', 'referenceImage', 'previewDataUrl'].includes(key)) return undefined;
    return value;
  });
}

function buildPrompt(scene, snapshot) {
  return `你是雅帝乐高端金属入户门的建筑摄影与产品还原专家。${scene.prompt}

参考图是当前用户已经定制完成的门体，属于强参考图，必须优先服从参考图中的产品事实。配置数据如下：${compactSnapshot(snapshot)}

严格保留产品事实：门扇宽高比例、门框和门套的层级关系、门扇厚度、门缝、合页侧、锁具数量与位置、拉手数量与位置、气窗/边门结构、前后门扇纹理方向、金属表面颜色和细节。不要重新设计门，不要替换门型，不要添加额外锁具、把手、黑色分割线、装饰窗或多余门套。只改变空间、地面、墙面、自然光、灯光和摄影机位置。门体必须完整出现在画面中，门扇纹理不拉伸，金属边缘和五金有真实反射，最终像真实交付项目的建筑摄影，而不是概念渲染或粗糙 3D 模型。无文字、无水印、无人遮挡门体。`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`);
  const url = imageUrlFromResponse(data);
  if (!url) throw new Error('AI 服务没有返回图片地址');
  return url;
}

async function postGeneration(config, prompt, referenceImage) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Number(config.timeoutMs) || 60000);
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'gpt-image-2',
        size: config.size || '1536x1024',
        quality: config.quality || 'high',
        prompt,
        referenceImage
      }),
      signal: controller.signal
    });
    return parseResponse(response);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('AI 生成超时，请稍后重试');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function initAiScene({ getSnapshot, getReferenceImage, onResults }) {
  const openButton = document.querySelector('#openAiScenes');
  const backdrop = document.querySelector('#aiSceneBackdrop');
  const panel = document.querySelector('#aiScenePanel');
  const list = document.querySelector('#aiSceneList');
  const progress = document.querySelector('#aiSceneProgress');
  const status = document.querySelector('#aiSceneStatus');
  const button = document.querySelector('#generateAiScenes');
  const referencePreview = document.querySelector('#aiReferencePreview');
  const referencePlaceholder = document.querySelector('#aiReferencePlaceholder');
  const refreshReferenceButton = document.querySelector('#refreshAiReference');
  if (!openButton || !backdrop || !panel || !list || !progress || !status || !button) return null;

  let running = false;
  let results = [];
  let selectedSceneKey = SCENE_PRESETS[0].key;
  let referenceImage = '';

  const selectedScene = () => SCENE_PRESETS.find((scene) => scene.key === selectedSceneKey) || SCENE_PRESETS[0];
  const setOpen = (open) => {
    backdrop.hidden = !open;
    backdrop.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    if (open && !running) {
      renderCards();
      void captureReference();
    }
  };

  const renderReference = () => {
    if (referenceImage) {
      if (referencePreview) {
        referencePreview.src = referenceImage;
        referencePreview.hidden = false;
      }
      if (referencePlaceholder) referencePlaceholder.hidden = true;
      return;
    }
    if (referencePreview) {
      referencePreview.removeAttribute('src');
      referencePreview.hidden = true;
    }
    if (referencePlaceholder) referencePlaceholder.hidden = false;
  };

  const captureReference = async () => {
    if (!getReferenceImage) return false;
    status.textContent = '正在截取当前定制门体，作为强参考图…';
    status.className = 'ai-scene-status loading';
    try {
      const next = await getReferenceImage();
      if (!next) throw new Error('无法截取当前门体预览');
      referenceImage = next;
      renderReference();
      status.textContent = `已锁定当前门体 · ${selectedScene().title} 待生成`;
      status.className = 'ai-scene-status';
      return true;
    } catch (error) {
      referenceImage = '';
      renderReference();
      status.textContent = `参考图准备失败：${error.message || '请刷新后重试'}`;
      status.className = 'ai-scene-status error';
      return false;
    }
  };

  const renderCards = () => {
    const resultMap = new Map(results.map((item) => [item.key, item]));
    list.innerHTML = SCENE_PRESETS.map((scene) => {
      const item = resultMap.get(scene.key);
      const stateClass = item?.status || 'idle';
      const selectedClass = selectedSceneKey === scene.key ? 'selected' : '';
      const content = item?.url
        ? `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(scene.title)} AI 场景方案" loading="lazy"><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看大图 ↗</a>`
        : `<div class="ai-scene-placeholder"><span>${item?.status === 'error' ? '!' : '✦'}</span><small>${escapeHtml(item?.message || '选择此场景后生成')}</small></div>`;
      return `<article class="ai-scene-card ${stateClass} ${selectedClass}"><button type="button" class="ai-scene-select" data-ai-scene-select="${escapeHtml(scene.key)}" aria-pressed="${selectedSceneKey === scene.key}"><span class="ai-scene-select-dot" aria-hidden="true"></span><span class="ai-scene-select-copy"><b>${escapeHtml(scene.title)}</b><small>${escapeHtml(scene.tag)}</small></span><i aria-hidden="true">${selectedSceneKey === scene.key ? '✓' : '＋'}</i></button><div class="ai-scene-media">${content}</div></article>`;
    }).join('');
  };

  const generate = async () => {
    if (running) return;
    const config = globalThis.YADILO_AI_CONFIG || {};
    if (!config.endpoint) {
      status.textContent = '尚未配置 AI 服务端代理。';
      status.className = 'ai-scene-status error';
      return;
    }
    const scene = selectedScene();
    if (!referenceImage && !(await captureReference())) return;
    running = true;
    const existing = results.find((item) => item.key === scene.key);
    const current = existing || { key: scene.key };
    Object.assign(current, { status: 'active', url: '', message: '准备发送强参考图' });
    if (!existing) results.push(current);
    button.disabled = true;
    button.textContent = `正在生成「${scene.title}」`;
    status.className = 'ai-scene-status loading';
    status.textContent = `正在以强参考模式生成「${scene.title}」…`;
    progress.style.width = '12%';
    renderCards();
    try {
      const snapshot = getSnapshot();
      const url = await postGeneration(config, buildPrompt(scene, snapshot), referenceImage);
      Object.assign(current, { status: 'done', url, message: '生成完成' });
      progress.style.width = '100%';
      status.className = 'ai-scene-status success';
      status.textContent = `「${scene.title}」已完成，门体细节按强参考图保留。`;
    } catch (error) {
      Object.assign(current, { status: 'error', message: error.message || '生成失败' });
      progress.style.width = '0%';
      status.className = 'ai-scene-status error';
      status.textContent = `生成失败：${error.message || '请稍后重试'}`;
    }
    running = false;
    button.disabled = false;
    button.textContent = `生成「${scene.title}」`;
    renderCards();
    onResults?.(results.filter((item) => item.status === 'done').map(({ key, url, message }) => ({ key, url, message, generatedAt: new Date().toISOString() })));
  };

  openButton.addEventListener('click', () => setOpen(true));
  backdrop.querySelectorAll('[data-close-ai-scenes]').forEach((item) => item.addEventListener('click', () => setOpen(false)));
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) setOpen(false); });
  list.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-ai-scene-select]');
    if (!choice || running) return;
    selectedSceneKey = choice.dataset.aiSceneSelect;
    progress.style.width = '0%';
    status.className = 'ai-scene-status';
    status.textContent = `已选择「${selectedScene().title}」 · 当前门体为强参考图`;
    button.textContent = `生成「${selectedScene().title}」`;
    renderCards();
  });
  refreshReferenceButton?.addEventListener('click', () => { void captureReference(); });
  button.addEventListener('click', generate);
  renderReference();
  renderCards();
  return { open: () => setOpen(true), close: () => setOpen(false), generate, refreshReference: captureReference };
}
