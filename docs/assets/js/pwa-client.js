(() => {
  document.documentElement.classList.add('is-pages-pwa', 'pwa-hub');
  const pageTargets = {
    study737: './737-study-finder/',
    izakaya_scout: './izakaya-scout/',
    lifeboard: './lifeboard/'
  };
  if (typeof window.renderModules === 'function') {
    const originalRenderModules = window.renderModules;
    window.renderModules = (modules) => {
      originalRenderModules((modules || []).map((module) => {
        const target = pageTargets[String(module.module_id || '')];
        return target ? Object.assign({}, module, { target_url: target }) : module;
      }));
    };
  }
  document.querySelectorAll('#setupButton, .admin-tools').forEach((element) => {
    element.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  window.addEventListener('offline', () => document.body.classList.add('is-offline'));
  window.addEventListener('online', () => document.body.classList.remove('is-offline'));
})();