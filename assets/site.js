(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manuallyPaused = false;
  try { manuallyPaused = localStorage.getItem('portfolio-motion') === 'paused'; } catch (_) {}
  let paused = reduced.matches || manuallyPaused;
  const motionButton = document.querySelector('.motion-toggle');
  const applyMotion = () => {
    paused = reduced.matches || manuallyPaused;
    root.classList.toggle('motion-paused', paused);
    if (motionButton) {
      motionButton.hidden = false;
      motionButton.textContent = reduced.matches ? 'Анимация: выключена в системе' : `Анимация: ${paused ? 'выключена' : 'включена'}`;
      motionButton.setAttribute('aria-label', reduced.matches ? 'Анимация отключена настройками устройства' : (paused ? 'Включить анимацию' : 'Приостановить анимацию'));
      motionButton.setAttribute('aria-pressed', String(paused));
      motionButton.disabled = reduced.matches;
    }
    scheduleScene();
  };
  motionButton?.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    try { localStorage.setItem('portfolio-motion', manuallyPaused ? 'paused' : 'running'); } catch (_) {}
    applyMotion();
  });
  reduced.addEventListener('change', applyMotion);

  document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const track = carousel.querySelector('.card-track');
    const cards = Array.from(track.querySelectorAll('.task-card'));
    const prev = carousel.querySelector('.prev');
    const next = carousel.querySelector('.next');
    const count = carousel.querySelector('.carousel-count');
    let index = 0, desired = 0, frame = 0, scrollTimer;
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    const step = () => cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth;
    const update = () => {
      frame = 0;
      const max = maxScroll();
      index = Math.min(cards.length - 1, Math.round(track.scrollLeft / step()));
      prev.disabled = track.scrollLeft < 3;
      next.disabled = track.scrollLeft >= max - 3;
      const lastVisible = Math.min(cards.length, index + Math.round(track.clientWidth / step()));
      count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      cards.forEach((card, i) => {
        // Active artwork changes when a card is brought into view; nothing relies on hover.
        card.classList.toggle('is-current', i >= index && i < Math.max(index + 1, lastVisible));
      });
    };
    const go = delta => {
      desired = Math.max(0, Math.min(maxScroll(), desired + delta * step()));
      track.scrollTo({ left: desired, behavior: paused ? 'instant' : 'smooth' });
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('keydown', event => {
      if (event.target !== track) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); go(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); desired = event.key === 'Home' ? 0 : maxScroll();
        track.scrollTo({ left: desired, behavior: paused ? 'instant' : 'smooth' });
      }
    });
    track.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(update);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { desired = track.scrollLeft; }, 160);
    }, { passive: true });
    const sync = () => { desired = track.scrollLeft; update(); };
    new ResizeObserver(sync).observe(track);
    update();
  });

  const bench = document.querySelector('.workbench');
  const ampersand = document.querySelector('.statement-mark');
  const steps = Array.from(document.querySelectorAll('.process-step'));
  const mapLinks = Array.from(document.querySelectorAll('.process-map a'));
  let sceneFrame = 0;
  function updateScene() {
    sceneFrame = 0;
    if (bench) {
      const hero = bench.closest('.hero');
      const progress = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / (hero.offsetHeight * .8)));
      bench.style.setProperty('--spread', paused ? 0 : progress.toFixed(3));
    }
    if (ampersand) {
      const bounds = ampersand.closest('.statement').getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (innerHeight - bounds.top) / (innerHeight + bounds.height)));
      ampersand.style.transform = paused ? 'rotate(-12deg)' : `rotate(${-20 + progress * 40}deg) translateY(${20 - progress * 40}px)`;
    }
    if (steps.length) {
      let active = 0;
      steps.forEach((step, i) => { if (step.getBoundingClientRect().top < innerHeight * .55) active = i; });
      mapLinks.forEach((link, i) => {
        link.classList.toggle('is-active', i === active);
        if (i === active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
      });
    }
  }
  function scheduleScene() { if (!sceneFrame) sceneFrame = requestAnimationFrame(updateScene); }
  if (bench && matchMedia('(pointer: fine)').matches) {
    bench.addEventListener('pointermove', event => {
      if (paused) return;
      const b = bench.getBoundingClientRect();
      bench.style.setProperty('--px', `${((event.clientX - b.left) / b.width - .5) * 12}deg`);
      bench.style.setProperty('--py', `${((event.clientY - b.top) / b.height - .5) * -10}deg`);
    });
    bench.addEventListener('pointerleave', () => { bench.style.setProperty('--px', '0deg'); bench.style.setProperty('--py', '0deg'); });
  }
  window.addEventListener('scroll', scheduleScene, { passive: true });
  window.addEventListener('resize', scheduleScene, { passive: true });
  document.addEventListener('visibilitychange', () => {
    document.querySelectorAll('.model-layer,.moving-ticket').forEach(el => { el.style.animationPlayState = document.hidden ? 'paused' : ''; });
  });
  applyMotion();
})();
