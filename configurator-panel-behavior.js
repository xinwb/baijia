export function installConfiguratorPanelBehavior(panel = document.querySelector('.order-panel')) {
  if (!panel) return;
  const sections = [...panel.querySelectorAll('.config-accordion')];
  if (!sections.length) return;
  const tabbedPanel = Boolean(panel.querySelector('.config-tabs'));

  let lastFocus = '';
  let lastFocusAt = 0;
  const isTextureFramingControl = (source) => Boolean(
    source?.closest?.('.texture-tools, .reference-texture-position')
      || source?.matches?.('#textureZoomSlider, #texturePanXSlider, #texturePanYSlider, #designOffsetXSlider, #designOffsetYSlider, #designScaleSlider, #resetTextureView')
  );
  const requestCameraFocus = (source, fallback = 'overview') => {
    const focusNode = source?.closest?.('[data-camera-focus]');
    const focus = tabbedPanel ? 'overview' : (focusNode?.dataset.cameraFocus || fallback);
    const now = performance.now();
    if (focus === lastFocus && now - lastFocusAt < 140) return;
    lastFocus = focus;
    lastFocusAt = now;
    panel.dataset.activeCameraFocus = focus;
    window.dispatchEvent(new CustomEvent('yadilo:camera-focus', {
      detail: { focus, source: focusNode || source || panel }
    }));
  };

  sections.forEach((section) => {
    section.open = true;
    section.addEventListener('toggle', () => {
      if (section.open) {
        requestCameraFocus(section, section.dataset.cameraFocus || 'overview');
        return;
      }
      queueMicrotask(() => {
        if (!sections.some((item) => item.open)) requestCameraFocus(panel, 'overview');
      });
    });
  });

  panel.addEventListener('pointerdown', (event) => {
    if (event.target.closest('summary')) return;
    // Texture framing keeps the panorama fixed; material sliders must not
    // re-enter the accordion camera-focus routine on every drag.
    if (isTextureFramingControl(event.target)) return;
    const section = event.target.closest('.config-accordion[open]');
    if (section) requestCameraFocus(event.target, section.dataset.cameraFocus || 'overview');
  });
  panel.addEventListener('focusin', (event) => {
    if (isTextureFramingControl(event.target)) return;
    const section = event.target.closest('.config-accordion[open]');
    if (section) requestCameraFocus(event.target, section.dataset.cameraFocus || 'overview');
  });
}
