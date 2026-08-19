(function () {
  var STORAGE_KEY = 'lqa_consent';
  var MAX_AGE_DAYS = 390; // CNIL recommends a maximum consent validity of ~13 months.

  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.ts !== 'number') return null;
      var ageDays = (Date.now() - data.ts) / 86400000;
      if (ageDays > MAX_AGE_DAYS) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeConsent() {
    var data = { analytics: true, ads: true, ts: Date.now() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // Storage unavailable (private mode, quota) — consent still applies for this page view.
    }
    return data;
  }

  function applyConsent(data) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
      analytics_storage: data.analytics ? 'granted' : 'denied',
      ad_storage: data.ads ? 'granted' : 'denied',
      ad_user_data: data.ads ? 'granted' : 'denied',
      ad_personalization: data.ads ? 'granted' : 'denied',
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('cookie-consent');
    if (!banner) return;

    function open() {
      banner.classList.remove('hidden');
    }

    function close() {
      banner.classList.add('hidden');
    }

    var existing = readConsent();
    if (existing) {
      applyConsent(existing);
    } else {
      open();
    }

    // The "pay to opt out" flow isn't built yet — until it is, both buttons
    // grant consent so visitors aren't blocked from the site.
    function acceptAll() {
      applyConsent(writeConsent());
      close();
    }

    banner.querySelector('[data-consent-accept]').addEventListener('click', acceptAll);
    banner.querySelector('[data-consent-pay]').addEventListener('click', acceptAll);

    window.lqaConsent = { open: open };

    document.querySelectorAll('[data-consent-open]').forEach(function (button) {
      button.addEventListener('click', function () {
        window.lqaConsent.open();
      });
    });
  });
})();
