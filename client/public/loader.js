// Gestion du message hors ligne et du loader initial, sans inline script
(function () {
  function onDOMContentLoaded() {
    var offlineMessage = document.getElementById('offline-message');

    if (offlineMessage && !navigator.onLine) {
      offlineMessage.style.display = 'flex';
    }

    window.addEventListener('online', function () {
      if (offlineMessage) offlineMessage.style.display = 'none';
    });

    window.addEventListener('offline', function () {
      if (offlineMessage) offlineMessage.style.display = 'flex';
    });

    // Fallback: masquer le loader après le chargement
    window.addEventListener('load', function () {
      var loader = document.getElementById('loader');
      if (!loader) return;
      setTimeout(function () {
        loader.classList.add('fade-out');
        setTimeout(function () {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 300);
      }, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  } else {
    onDOMContentLoaded();
  }
})();


