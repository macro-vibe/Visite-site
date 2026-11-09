(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let content;
  const applyMotion = () => {
    root.classList.toggle('motion-paused', reduced.matches);
    content?.refresh();
  };
  try { localStorage.removeItem('portfolio-motion'); } catch (_) {}
  reduced.addEventListener('change', applyMotion);
  applyMotion();

  function initContent() {
    const scope = document.querySelector('main#main');
    const controller = new AbortController();
    const signal = controller.signal;
    const observers = [];
    let frame = 0;
    const listen = (target, type, fn, options = {}) => target.addEventListener(type, fn, { ...options, signal });
    scope.querySelectorAll('[data-carousel]').forEach(carousel => {
      const track = carousel.querySelector('.card-track');
      const cards = Array.from(track.querySelectorAll('.task-card'));
      const slides = cards.map(card => card.closest('.card-slide') || card);
      const prev = carousel.querySelector('.prev');
      const next = carousel.querySelector('.next');
      const count = carousel.querySelector('.carousel-count');
      let desired = track.scrollLeft;
      let timer;
      const max = () => track.scrollWidth - track.clientWidth;
      const step = () => slides[1].offsetLeft - slides[0].offsetLeft;
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
    const bench = scope.querySelector('.workbench');
    const steps = Array.from(scope.querySelectorAll('.process-step'));
    const links = Array.from(scope.querySelectorAll('.process-map a'));
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

  // Scrolling and in-page links use the browser's native behavior.
  // Only the service carousel owns horizontal gestures/arrow keys.
  if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  content = initContent();
  const bench = document.querySelector('.workbench');
  let modelVisible = true;
  const updateAnimationVisibility = () => {
    bench?.querySelectorAll('.model-layer,.signal').forEach(el => {
      el.style.animationPlayState = document.hidden || !modelVisible ? 'paused' : '';
    });
  };
  if (bench) {
    new IntersectionObserver(entries => {
      modelVisible = entries[0].isIntersecting;
      updateAnimationVisibility();
    }).observe(bench);
  }
  document.addEventListener('visibilitychange', updateAnimationVisibility);
})();
