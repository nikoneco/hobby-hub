(() => {
  document.documentElement.classList.add('is-pages-pwa', 'pwa-lifeboard');
  document.querySelectorAll('#setupButton, .admin-tools').forEach((element) => {
    element.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register("../sw.js").catch(() => {});
    });
  }

  window.addEventListener('offline', () => document.body.classList.add('is-offline'));
  window.addEventListener('online', () => document.body.classList.remove('is-offline'));
})();