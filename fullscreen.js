const toggle = document.querySelector('#toggleFullscreen');

if (toggle) {
  const root = document.documentElement;
  const fullscreenElement = () => (
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.msFullscreenElement
    || null
  );
  const requestFullscreen = () => {
    const request = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    return request ? Promise.resolve(request.call(root)) : Promise.reject(new Error('Fullscreen API unavailable'));
  };
  const exitFullscreen = () => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    return exit ? Promise.resolve(exit.call(document)) : Promise.reject(new Error('Fullscreen API unavailable'));
  };
  const usingNativeFullscreen = () => Boolean(
    root.requestFullscreen
    || root.webkitRequestFullscreen
    || root.msRequestFullscreen
  );
  const usingFallback = () => document.body.classList.contains('is-pseudo-fullscreen');

  const sync = () => {
    const active = Boolean(fullscreenElement()) || usingFallback();
    toggle.textContent = active ? '退出全屏' : '全屏';
    toggle.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
    toggle.setAttribute('aria-pressed', String(active));
    toggle.title = active ? '退出全屏' : '进入全屏';
    toggle.classList.toggle('active', active);
  };

  toggle.addEventListener('click', async () => {
    try {
      if (fullscreenElement()) {
        await exitFullscreen();
      } else if (usingFallback()) {
        document.body.classList.remove('is-pseudo-fullscreen');
      } else if (usingNativeFullscreen()) {
        await requestFullscreen();
      } else {
        // A few embedded webviews deny the native API; keep the control useful.
        document.body.classList.add('is-pseudo-fullscreen');
      }
    } catch (error) {
      console.warn('[YADILO] Fullscreen unavailable', error);
      document.body.classList.toggle('is-pseudo-fullscreen');
    }
    sync();
  });

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('MSFullscreenChange', sync);
  sync();
}
