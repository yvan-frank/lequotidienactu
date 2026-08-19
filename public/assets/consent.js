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

  function writeConsent(analytics, ads) {
    var data = { analytics: !!analytics, ads: !!ads, ts: Date.now() };
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
    var details = document.getElementById('cookie-consent-details');
    var toggleAnalytics = banner.querySelector('[data-consent-toggle="analytics"]');
    var toggleAds = banner.querySelector('[data-consent-toggle="ads"]');

    function open(showDetails) {
      banner.classList.remove('hidden');
      if (showDetails) details.classList.remove('hidden');
    }

    function close() {
      banner.classList.add('hidden');
      details.classList.add('hidden');
    }

    var existing = readConsent();
    if (existing) {
      applyConsent(existing);
    } else {
      open(false);
    }

    banner.querySelector('[data-consent-accept]').addEventListener('click', function () {
      applyConsent(writeConsent(true, true));
      close();
    });

    banner.querySelector('[data-consent-reject]').addEventListener('click', function () {
      applyConsent(writeConsent(false, false));
      close();
    });

    banner.querySelector('[data-consent-customize]').addEventListener('click', function () {
      var current = readConsent();
      toggleAnalytics.checked = !!(current && current.analytics);
      toggleAds.checked = !!(current && current.ads);
      details.classList.toggle('hidden');
    });

    banner.querySelector('[data-consent-save]').addEventListener('click', function () {
      applyConsent(writeConsent(toggleAnalytics.checked, toggleAds.checked));
      close();
    });

    window.lqaConsent = {
      open: function () {
        var current = readConsent();
        toggleAnalytics.checked = !!(current && current.analytics);
        toggleAds.checked = !!(current && current.ads);
        open(true);
      },
    };

    document.querySelectorAll('[data-consent-open]').forEach(function (button) {
      button.addEventListener('click', function () {
        window.lqaConsent.open();
      });
    });
  });
})();
