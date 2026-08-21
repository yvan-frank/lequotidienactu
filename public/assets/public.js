document.querySelectorAll('[data-island="newsletter"]').forEach((form) => {
  const input = form.querySelector('input[name="email"]');
  const submitButton = form.querySelector('[data-newsletter-submit]');
  const spinner = form.querySelector('[data-newsletter-spinner]');
  const label = form.querySelector('[data-newsletter-label]');
  const message = form.querySelector('[data-newsletter-message]');
  const submitLabel = label ? label.textContent : '';

  const setMessage = (text, tone) => {
    if (input) {
      input.classList.toggle('border-red-500', tone === 'error');
      input.classList.toggle('border-slate-700', tone !== 'error');
    }
    if (!message) return;
    message.textContent = text;
    message.classList.remove('hidden', 'text-emerald-400', 'text-red-400', 'text-slate-400');
    message.classList.add(tone === 'error' ? 'text-red-400' : tone === 'success' ? 'text-emerald-400' : 'text-slate-400');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    // event.currentTarget is cleared by the browser once the synchronous part
    // of event dispatch finishes, which happens before this `await` resolves —
    // use the closed-over `form` reference instead of the event afterward.
    const email = new FormData(form).get('email');
    submitButton?.setAttribute('disabled', 'true');
    input?.setAttribute('disabled', 'true');
    spinner?.classList.remove('hidden');
    if (label) label.textContent = 'Envoi…';
    if (message) message.classList.add('hidden');
    input?.classList.remove('border-red-500');
    input?.classList.add('border-slate-700');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setMessage(data.message || 'Inscription envoyée.', 'success');
        form.reset();
      } else {
        setMessage(data.message || 'Impossible de finaliser l’inscription. Réessayez.', 'error');
      }
    } catch {
      setMessage('Erreur réseau. Vérifiez votre connexion et réessayez.', 'error');
    } finally {
      submitButton?.removeAttribute('disabled');
      input?.removeAttribute('disabled');
      spinner?.classList.add('hidden');
      if (label) label.textContent = submitLabel;
    }
  });
});

if (document.querySelector('.featured-swiper')) {
  new Swiper('.featured-swiper', {
    loop: true,
    slidesPerView: 1,
    spaceBetween: 16,
    keyboard: { enabled: true },
    navigation: { nextEl: '.featured-next', prevEl: '.featured-prev' },
    pagination: { el: '.featured-pagination', clickable: true },
    autoplay: { delay: 6000, disableOnInteraction: false, pauseOnMouseEnter: true },
  });
}

const MEGA_MENU_CLOSE_DURATION = 180;
const megaBackdrop = document.querySelector('[data-mega-backdrop]');
const mobileMenu = document.querySelector('[data-mobile-menu]');
const mobileMenuTrigger = document.querySelector('[data-mobile-menu-trigger]');
const mobileMenuClose = document.querySelector('[data-mobile-menu-close]');

function isMobileMenuOpen() {
  return Boolean(mobileMenu && !mobileMenu.classList.contains('translate-x-full'));
}

function openMegaBackdrop() {
  if (!megaBackdrop) return;
  megaBackdrop.classList.remove('is-closing');
  megaBackdrop.classList.add('is-open');
}

function closeMegaBackdropIfNoneOpen() {
  if (!megaBackdrop || !megaBackdrop.classList.contains('is-open')) return;
  if (document.querySelector('nav details[open]') || isMobileMenuOpen()) return;
  megaBackdrop.classList.add('is-closing');
  window.setTimeout(() => {
    megaBackdrop.classList.remove('is-open');
    megaBackdrop.classList.remove('is-closing');
  }, MEGA_MENU_CLOSE_DURATION);
}

function closeMegaMenu(details) {
  if (!details || !details.hasAttribute('open') || details.classList.contains('is-closing')) return;
  details.classList.add('is-closing');
  window.setTimeout(() => {
    details.removeAttribute('open');
    details.classList.remove('is-closing');
    closeMegaBackdropIfNoneOpen();
  }, MEGA_MENU_CLOSE_DURATION);
}

document.querySelectorAll('nav details').forEach((menu) => {
  menu.addEventListener('toggle', () => {
    if (!menu.open) return;
    openMegaBackdrop();
    document.querySelectorAll('nav details[open]').forEach((otherMenu) => {
      if (otherMenu !== menu) closeMegaMenu(otherMenu);
    });
  });
  menu.querySelector(':scope > summary')?.addEventListener('click', (event) => {
    if (menu.hasAttribute('open')) {
      event.preventDefault();
      closeMegaMenu(menu);
    }
  });
});

function openMobileMenu() {
  if (!mobileMenu || isMobileMenuOpen()) return;
  mobileMenu.classList.remove('translate-x-full');
  mobileMenuTrigger?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  openMegaBackdrop();
}

function closeMobileMenu() {
  if (!mobileMenu || !isMobileMenuOpen()) return;
  mobileMenu.classList.add('translate-x-full');
  mobileMenuTrigger?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  closeMegaBackdropIfNoneOpen();
}

mobileMenuTrigger?.addEventListener('click', () => {
  isMobileMenuOpen() ? closeMobileMenu() : openMobileMenu();
});
mobileMenuClose?.addEventListener('click', closeMobileMenu);

document.addEventListener('click', (event) => {
  if (event.target.closest('nav details')) return;
  document.querySelectorAll('nav details[open]').forEach(closeMegaMenu);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('nav details[open]').forEach(closeMegaMenu);
  closeMobileMenu();
});

megaBackdrop?.addEventListener('click', () => {
  document.querySelectorAll('nav details[open]').forEach(closeMegaMenu);
  closeMobileMenu();
});

const siteHeader = document.querySelector('[data-site-header]');
const readingProgress = document.querySelector('[data-reading-progress]');
const readingProgressBar = document.querySelector('[data-reading-progress-bar]');
const readingStart = document.querySelector('[data-reading-start]');

if (siteHeader) {
  const updateHeaderState = () => {
    const alreadyScrolled = siteHeader.dataset.scrolled === 'true';
    const shrinkAt = 40;
    const growAt = 16;
    siteHeader.dataset.scrolled = alreadyScrolled
      ? (window.scrollY > growAt ? 'true' : 'false')
      : (window.scrollY > shrinkAt ? 'true' : 'false');

    if (readingProgress && readingStart) {
      const rect = readingStart.getBoundingClientRect();
      const startY = rect.top + window.scrollY;
      const totalHeight = rect.height;
      const isReading = window.scrollY > startY - 72;

      siteHeader.classList.toggle('-translate-y-full', isReading);
      readingProgress.classList.toggle('-translate-y-full', !isReading);

      if (isReading && readingProgressBar) {
        const read = Math.min(Math.max(window.scrollY - startY, 0), totalHeight);
        const percent = totalHeight > 0 ? (read / totalHeight) * 100 : 0;
        readingProgressBar.style.width = percent + '%';
      }
    }
  };
  let headerStateQueued = false;
  const queueHeaderStateUpdate = () => {
    if (headerStateQueued) return;
    headerStateQueued = true;
    requestAnimationFrame(() => {
      headerStateQueued = false;
      updateHeaderState();
    });
  };
  updateHeaderState();
  window.addEventListener('scroll', queueHeaderStateUpdate, { passive: true });
  window.addEventListener('resize', queueHeaderStateUpdate);
}

const lightboxTargets = document.querySelectorAll(
  '[data-lightbox], [data-reading-start] img',
);
const lightboxOverlay = document.querySelector('[data-lightbox-overlay]');
if (lightboxTargets.length > 0 && lightboxOverlay) {
  const overlayImage = lightboxOverlay.querySelector('[data-lightbox-image]');
  const overlayCaption = lightboxOverlay.querySelector('[data-lightbox-caption]');
  const overlayClose = lightboxOverlay.querySelector('[data-lightbox-close]');

  const openLightbox = (src, alt) => {
    overlayImage.src = src;
    overlayImage.alt = alt || '';
    overlayCaption.textContent = alt || '';
    overlayCaption.classList.toggle('is-empty', !alt);
    lightboxOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const closeLightbox = () => {
    if (!lightboxOverlay.classList.contains('is-open')) return;
    lightboxOverlay.classList.remove('is-open');
    overlayImage.src = '';
    document.body.style.overflow = '';
  };

  lightboxTargets.forEach((image) => {
    image.addEventListener('click', () =>
      openLightbox(image.currentSrc || image.src, image.alt),
    );
  });
  overlayClose.addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', (event) => {
    if (event.target === lightboxOverlay) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLightbox();
  });
}

document.addEventListener('click', (event) => {
  const ad = event.target.closest('[data-ad-id]');
  if (!ad) return;
  const body = JSON.stringify({});
  if (navigator.sendBeacon) {
    navigator.sendBeacon(`/api/ads/${ad.dataset.adId}/click`, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(`/api/ads/${ad.dataset.adId}/click`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  }
});

// Web Push opt-in widget — feature-detected, so it stays fully hidden on
// browsers/contexts without Notification+PushManager support (e.g. iOS
// Safari outside a home-screen install, or plain HTTP in dev).
{
  const widget = document.querySelector('[data-push-widget]');
  const supported =
    widget && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (supported) {
    const trigger = widget.querySelector('[data-push-trigger]');
    const panel = widget.querySelector('[data-push-panel]');
    const enableBtn = widget.querySelector('[data-push-enable]');
    const disableBtn = widget.querySelector('[data-push-disable]');
    const statusEl = widget.querySelector('[data-push-status]');
    const categoryInputs = [...widget.querySelectorAll('[data-push-category]')];
    const vapidKey = widget.dataset.vapidPublicKey || '';

    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
    };

    const setEnabledState = (enabled) => {
      enableBtn.classList.toggle('hidden', enabled);
      disableBtn.classList.toggle('hidden', !enabled);
    };

    const refreshState = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.getSubscription();
        setEnabledState(Boolean(subscription) && Notification.permission === 'granted');
      } catch {
        // Registration can fail in dev over plain HTTP; leave the default (disabled) state.
      }
    };

    trigger.classList.remove('hidden');
    trigger.addEventListener('click', () => {
      const isOpen = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden', isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', (event) => {
      if (!widget.contains(event.target)) panel.classList.add('hidden');
    });

    enableBtn.addEventListener('click', async () => {
      statusEl.textContent = '';
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          statusEl.textContent = 'Autorisation refusée.';
          return;
        }
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        const categories = categoryInputs.filter((input) => input.checked).map((input) => input.value);
        const json = subscription.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, categories }),
        });
        setEnabledState(true);
        statusEl.textContent = 'Notifications activées.';
      } catch {
        statusEl.textContent = 'Impossible d’activer les notifications.';
      }
    });

    disableBtn.addEventListener('click', async () => {
      statusEl.textContent = '';
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        const subscription = registration && (await registration.pushManager.getSubscription());
        if (subscription) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
        setEnabledState(false);
        statusEl.textContent = 'Notifications désactivées.';
      } catch {
        statusEl.textContent = 'Impossible de désactiver les notifications.';
      }
    });

    refreshState();
  }
}

import Swiper from '/vendor/swiper/swiper-bundle.min.mjs';
