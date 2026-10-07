(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const activeTheme = () => root.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
  function updateThemeToggle() {
    const dark = activeTheme() === 'dark';
    toggle.setAttribute('aria-label', `Use ${dark ? 'light' : 'dark'} mode`);
    toggle.setAttribute('aria-pressed', String(dark));
  }
  toggle.addEventListener('click', () => {
    root.dataset.theme = activeTheme() === 'dark' ? 'light' : 'dark';
    updateThemeToggle();
  });
  systemTheme.addEventListener('change', updateThemeToggle);
  updateThemeToggle();

  const filmLinks = [...document.querySelectorAll('.film-index a')];
  const films = filmLinks.map(link => document.querySelector(link.getAttribute('href')));
  let indexUpdatePending = false;
  function updateFilmIndex() {
    let active = 0;
    films.forEach((film, index) => {
      if (film.getBoundingClientRect().top <= window.innerHeight * 0.5) active = index;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = films.length - 1;
    }
    filmLinks.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    indexUpdatePending = false;
  }
  function scheduleFilmIndexUpdate() {
    if (!indexUpdatePending) {
      indexUpdatePending = true;
      window.requestAnimationFrame(updateFilmIndex);
    }
  }
  window.addEventListener('scroll', scheduleFilmIndexUpdate, { passive: true });
  window.addEventListener('resize', scheduleFilmIndexUpdate);
  updateFilmIndex();

  const carousels = [...document.querySelectorAll('[data-carousel]')].map(element => ({
    element,
    slides: [...element.querySelectorAll('.carousel-slide')],
    count: element.querySelector('.carousel-count'),
  })).filter(carousel => carousel.slides.length);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let step = 0;
  let paused = reducedMotion.matches;
  let timer;
  // One shared step and timer keep every project's carousel synchronized,
  // even when projects contain different numbers of images.
  function render(manual = false) {
    for (const { element, slides, count } of carousels) {
      const index = ((step % slides.length) + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        slide.hidden = position !== index;
        slide.classList.toggle('is-active', position === index);
      });
      const next = slides[(index + 1) % slides.length];
      next.loading = 'eager';
      count.setAttribute('aria-live', manual ? 'polite' : 'off');
      count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
      element.querySelectorAll('[data-pause]').forEach(button => {
        button.textContent = paused ? 'Play' : 'Pause';
        button.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} all carousels`);
        button.setAttribute('aria-pressed', String(paused));
      });
    }
  }

  function schedule() {
    window.clearInterval(timer);
    const focused = carousels.some(({ element }) => element.contains(document.activeElement));
    if (!paused && !document.hidden && !focused && carousels.some(({ slides }) => slides.length > 1)) {
      timer = window.setInterval(() => { step += 1; render(); }, 6000);
    }
  }

  function advance(direction) {
    step += direction;
    render(true);
    schedule();
  }

  for (const { element } of carousels) {
    element.querySelector('.carousel-controls').hidden = false;
    element.querySelectorAll('[data-direction]').forEach(button => {
      button.addEventListener('click', () => advance(Number(button.dataset.direction)));
    });
    element.querySelectorAll('[data-pause]').forEach(button => {
      button.addEventListener('click', () => { paused = !paused; render(); schedule(); });
    });
    element.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        advance(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    element.addEventListener('focusin', schedule);
    element.addEventListener('focusout', () => window.setTimeout(schedule, 0));
    let touchStart;
    element.addEventListener('touchstart', event => {
      const touch = event.changedTouches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    element.addEventListener('touchend', event => {
      if (!touchStart) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) advance(dx < 0 ? 1 : -1);
      touchStart = null;
    }, { passive: true });
  }
  reducedMotion.addEventListener('change', () => {
    paused = reducedMotion.matches;
    render();
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  render();
  schedule();
})();
