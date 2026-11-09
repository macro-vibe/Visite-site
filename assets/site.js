(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pages = [
    { file: 'index.html', name: 'Главная', cls: 'page-home' },
    { file: 'services.html', name: 'Услуги', cls: 'page-services' },
    { file: 'approach.html', name: 'Процесс', cls: 'page-approach' },
    { file: 'contact.html', name: 'Контакт', cls: 'page-contact' }
  ];
  const base = new URL('./', location.href);
  const pageIndex = url => pages.findIndex(p => new URL(p.file, base).pathname === (url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
  let current = pageIndex(new URL(location.href));
  let busy = false;
  let content;
  const applyMotion = () => {
    root.classList.toggle('motion-paused', reduced.matches);
    content?.refresh();
  };
  // The removed manual control must not leave returning visitors stuck in pause mode.
  try { localStorage.removeItem('portfolio-motion'); } catch (_) {}
  reduced.addEventListener('change', applyMotion);
  applyMotion();

  function initContent() {
    const controller = new AbortController();
    const signal = controller.signal;
    const observers = [];
    let frame = 0;
    const listen = (target, type, fn, options = {}) => target.addEventListener(type, fn, { ...options, signal });
    document.querySelectorAll('[data-carousel]').forEach(carousel => {
      const track = carousel.querySelector('.card-track');
      const cards = Array.from(track.querySelectorAll('.task-card'));
      const prev = carousel.querySelector('.prev');
      const next = carousel.querySelector('.next');
      const count = carousel.querySelector('.carousel-count');
      let desired = track.scrollLeft;
      let timer;
      const max = () => track.scrollWidth - track.clientWidth;
      const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
      const update = () => {
        const index = Math.min(cards.length - 1, Math.round(track.scrollLeft / step()));
        prev.disabled = track.scrollLeft < 3;
        next.disabled = track.scrollLeft >= max() - 3;
        count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
        const visible = Math.max(1, Math.round(track.clientWidth / step()));
        cards.forEach((card, i) => card.classList.toggle('is-current', i >= index && i < index + visible));
      };
      const go = delta => {
        desired = Math.max(0, Math.min(max(), desired + delta * step()));
        track.scrollTo({ left: desired, behavior: reduced.matches ? 'instant' : 'smooth' });
      };
      listen(prev, 'click', () => go(-1));
      listen(next, 'click', () => go(1));
      listen(track, 'keydown', event => {
        if (event.target !== track) return;
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key.startsWith('Arrow')) go(event.key === 'ArrowRight' ? 1 : -1);
          else {
            desired = event.key === 'Home' ? 0 : max();
            track.scrollTo({ left: desired, behavior: reduced.matches ? 'instant' : 'smooth' });
          }
        }
      });
      listen(track, 'scroll', () => {
        update();
        clearTimeout(timer);
        timer = setTimeout(() => { desired = track.scrollLeft; }, 160);
      }, { passive: true });
      signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
      const observer = new ResizeObserver(() => { desired = track.scrollLeft; update(); });
      observer.observe(track);
      observers.push(observer);
      update();
    });
    const bench = document.querySelector('.workbench');
    const steps = Array.from(document.querySelectorAll('.process-step'));
    const links = Array.from(document.querySelectorAll('.process-map a'));
    const update = () => {
      frame = 0;
      if (bench) {
        const hero = bench.closest('.hero');
        const progress = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / (hero.offsetHeight * .8)));
        bench.style.setProperty('--spread', reduced.matches ? 0 : progress.toFixed(3));
      }
      if (steps.length) {
        let active = 0;
        steps.forEach((step, i) => { if (step.getBoundingClientRect().top < innerHeight * .55) active = i; });
        links.forEach((link, i) => {
          link.classList.toggle('is-active', i === active);
          if (i === active) link.setAttribute('aria-current', 'step');
          else link.removeAttribute('aria-current');
        });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    listen(window, 'scroll', schedule, { passive: true });
    listen(window, 'resize', schedule, { passive: true });
    schedule();
    return { refresh: schedule, destroy() { controller.abort(); observers.forEach(o => o.disconnect()); cancelAnimationFrame(frame); } };
  }

  const updateNavigation = () => {
    document.querySelectorAll('.site-header nav a').forEach(link => {
      if (pageIndex(new URL(link.href)) === current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('.section-position').textContent = `${String(current + 1).padStart(2, '0')} / 04`;
    document.querySelector('.section-name').textContent = pages[current].name;
    document.querySelectorAll('[data-page-step]').forEach(link => {
      const target = current + Number(link.dataset.pageStep);
      const disabled = target < 0 || target >= pages.length;
      if (disabled) {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
      } else {
        link.href = new URL(pages[target].file, base).href;
        link.setAttribute('aria-label', `${target < current ? 'Предыдущий' : 'Следующий'} раздел: ${pages[target].name}`);
        link.removeAttribute('aria-disabled');
        link.removeAttribute('tabindex');
      }
    });
  };

  async function navigate(url, { pop = false, scroll = null } = {}) {
    const target = pageIndex(url);
    if (target < 0 || busy) return;
    if (target === current && !pop) return;
    busy = true;
    root.classList.add('page-loading');
    const direction = target >= current ? 1 : -1;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 8000);
    let next;
    try {
      const response = await fetch(url.href, { signal: abort.signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('Page unavailable');
      next = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (!next.querySelector('main#main') || !next.body.classList.contains(pages[target].cls)) throw new Error('Unexpected page');
    } catch (_) {
      // Keep real page URLs and ordinary navigation available when fetching fails.
      location.assign(url.href);
      return;
    } finally { clearTimeout(timeout); }

    if (!pop) history.replaceState({ ...history.state, scroll: { x: scrollX, y: scrollY } }, '', location.href);
    root.style.setProperty('--page-direction', direction);
    const swap = () => {
      content.destroy();
      const main = document.importNode(next.querySelector('main#main'), true);
      main.tabIndex = -1;
      document.querySelector('main#main').replaceWith(main);
      document.body.className = next.body.className;
      document.title = next.title;
      for (const selector of ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]']) {
        document.querySelector(selector).content = next.querySelector(selector).content;
      }
      if (!pop) history.pushState({ scroll: { x: 0, y: 0 } }, '', url.href);
      current = target;
      updateNavigation();
      content = initContent();
      window.scrollTo({ left: scroll?.x || 0, top: scroll?.y || 0, behavior: 'instant' });
      if (url.hash && !scroll) document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' });
      main.focus({ preventScroll: true });
    };
    try {
      if (reduced.matches) swap();
      else if (document.startViewTransition) {
        await document.startViewTransition(swap).finished.catch(() => {});
      } else {
        await document.querySelector('main').animate([
          { transform: 'translateX(0)', opacity: 1 },
          { transform: `translateX(${-direction * 70}px)`, opacity: 0 }
        ], { duration: 160, easing: 'ease-in', fill: 'forwards' }).finished;
        swap();
        await document.querySelector('main').animate([
          { transform: `translateX(${direction * 90}px)`, opacity: 0 },
          { transform: 'translateX(0)', opacity: 1 }
        ], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' }).finished;
      }
    } finally {
      root.classList.remove('page-loading');
      busy = false;
    }
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || pageIndex(url) < 0) return;
    if (pageIndex(url) === current && url.hash) return;
    event.preventDefault();
    if (pageIndex(url) !== current) navigate(url);
  });
  window.addEventListener('popstate', event => {
    // A quick Back during a transition should still reach the browser's chosen URL.
    if (busy) { location.reload(); return; }
    navigate(new URL(location.href), { pop: true, scroll: event.state?.scroll });
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    if (event.target.closest('a,button,input,textarea,select,summary,[contenteditable],.card-track')) return;
    const target = current + (event.key === 'ArrowRight' ? 1 : -1);
    if (target < 0 || target >= pages.length) return;
    event.preventDefault();
    navigate(new URL(pages[target].file, base));
  });

  let gesture = null;
  document.addEventListener('touchstart', event => {
    gesture = null;
    if (busy || event.touches.length !== 1 || event.target.closest('.card-track,a,button,input,textarea,select,summary,[contenteditable]')) return;
    const touch = event.touches[0];
    // Reserve the physical edges for the browser's own Back gesture.
    if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
    gesture = { x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, axis: null };
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    if (event.touches.length !== 1) { gesture = null; return; }
    gesture.dx = event.touches[0].clientX - gesture.x;
    gesture.dy = event.touches[0].clientY - gesture.y;
    if (!gesture.axis && Math.max(Math.abs(gesture.dx), Math.abs(gesture.dy)) > 12) {
      gesture.axis = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4 ? 'x' : 'y';
    }
    if (gesture.axis === 'x' && event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => {
    const done = gesture;
    gesture = null;
    if (!done || done.axis !== 'x' || Math.abs(done.dx) < 64) return;
    const target = current + (done.dx < 0 ? 1 : -1);
    if (target >= 0 && target < pages.length) navigate(new URL(pages[target].file, base));
  }, { passive: true });
  document.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    document.querySelectorAll('.model-layer,.signal').forEach(el => { el.style.animationPlayState = document.hidden ? 'paused' : ''; });
  });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  content = initContent();
  updateNavigation();
})();
