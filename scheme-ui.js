import { downloadScheme, formatSchemeTime, listSchemes, removeScheme, upsertScheme } from './scheme-store.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

export function initSchemeUi({ getCurrent, applyScheme, onSaved }) {
  const openButton = document.querySelector('#openSchemes');
  const saveButton = document.querySelector('#saveScheme');
  const backdrop = document.querySelector('#schemeBackdrop');
  const drawer = document.querySelector('#schemeDrawer');
  const list = document.querySelector('#schemeList');
  const count = document.querySelector('#schemeCount');
  if (!openButton || !saveButton || !backdrop || !drawer || !list) return null;

  const setOpen = (open) => {
    backdrop.hidden = !open;
    backdrop.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    if (open) render();
  };

  const render = () => {
    const schemes = listSchemes();
    if (count) count.textContent = String(schemes.length);
    if (!schemes.length) {
      list.innerHTML = '<div class="scheme-empty"><span>◌</span><b>还没有个人方案</b><small>调整好门体后，点击右上角“保存方案”即可留存。</small></div>';
      return;
    }
    list.innerHTML = schemes.map((scheme) => {
      const config = scheme.config || {};
      const order = scheme.orderPayload?.fields || {};
      const templateId = typeof order.door_template_id === 'object'
        ? (order.door_template_id.code || order.door_template_id.id || order.door_template_id.name || '')
        : order.door_template_id;
      const summary = [config.width && `${config.width} × ${config.height} mm`, config.typeLabel, config.lockLabel, config.handleLabel].filter(Boolean).join(' · ');
      return `<article class="scheme-card" data-scheme-id="${escapeHtml(scheme.id)}">
        <div class="scheme-card-main"><span class="scheme-series">${escapeHtml(scheme.series)}</span><div><b>${escapeHtml(scheme.title)}</b><small>${escapeHtml(summary || scheme.productLabel || '方案配置')}</small></div></div>
        <div class="scheme-card-meta"><span>${escapeHtml(formatSchemeTime(scheme.updatedAt))}</span><span>${templateId ? `模板 ${escapeHtml(templateId)}` : '待映射订单模板'}</span></div>
        <div class="scheme-card-actions"><button type="button" data-scheme-action="restore" data-scheme-id="${escapeHtml(scheme.id)}">继续编辑</button><button type="button" data-scheme-action="export" data-scheme-id="${escapeHtml(scheme.id)}">导出下单数据</button><button type="button" class="quiet" data-scheme-action="delete" data-scheme-id="${escapeHtml(scheme.id)}">删除</button></div>
      </article>`;
    }).join('');
  };

  saveButton.addEventListener('click', () => {
    const saved = upsertScheme(getCurrent());
    onSaved?.(saved);
    saveButton.textContent = '已保存到个人方案';
    saveButton.classList.add('saved');
    openButton.classList.add('has-new');
    window.setTimeout(() => {
      saveButton.textContent = '保存方案';
      saveButton.classList.remove('saved');
      openButton.classList.remove('has-new');
    }, 1800);
    render();
    if (!saved) setOpen(true);
  });
  openButton.addEventListener('click', () => setOpen(true));
  backdrop.querySelectorAll('[data-close-schemes]').forEach((button) => button.addEventListener('click', () => setOpen(false)));
  backdrop.addEventListener('click', async (event) => {
    if (event.target === backdrop) {
      setOpen(false);
      return;
    }
    const action = event.target.closest('[data-scheme-action]');
    if (!action) return;
    const id = action.dataset.schemeId;
    const scheme = listSchemes().find((item) => item.id === id);
    if (!scheme) return;
    if (action.dataset.schemeAction === 'restore') {
      await applyScheme(scheme);
      setOpen(false);
    } else if (action.dataset.schemeAction === 'export') {
      downloadScheme(scheme, `${scheme.series}-${scheme.product}-order-payload.json`);
    } else if (action.dataset.schemeAction === 'delete') {
      if (window.confirm('删除这个个人方案？')) {
        removeScheme(id);
        render();
      }
    }
  });
  window.addEventListener('yadilo:scheme-saved', render);
  window.addEventListener('yadilo:scheme-removed', render);
  render();
  return { render, open: () => setOpen(true), close: () => setOpen(false) };
}
