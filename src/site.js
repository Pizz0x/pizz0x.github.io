// Filippo Pizzo — portfolio. Small, dependency-free behaviour; every part degrades to plain links.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  // ---------- reveal once (sections, structure drawing) ----------
  const targets = document.querySelectorAll('[data-reveal], .dendro');
  const reveal = (el) => {
    el.classList.add('is-in');
    // after its entrance, drop the stagger so hover effects are immediate
    setTimeout(() => el.classList.add('is-done'), 950 + (parseFloat(getComputedStyle(el).getPropertyValue('--i')) || 0) * 80);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    targets.forEach((el) => io.observe(el));
    addEventListener('load', () => setTimeout(() => targets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) reveal(el);
    }), 2500));
  } else targets.forEach(reveal);

  // ---------- top bar: frosted once the page moves, hidden while reading down, back on the way up ----------
  const bar = document.querySelector('.bar');
  if (bar) {
    let lastY = scrollY; let ticking = false;
    const update = () => {
      ticking = false;
      const y = scrollY;
      bar.classList.toggle('is-stuck', y > 8);
      if (Math.abs(y - lastY) > 6) { bar.classList.toggle('is-hidden', y > lastY && y > 240); lastY = y; }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ---------- top bar: one gold line slides to the link pointed at, and rests under the current page ----------
  const nav = document.querySelector('.bar__nav');
  if (nav && fine.matches) {
    const line = document.createElement('span');
    line.className = 'bar__line'; line.setAttribute('aria-hidden', 'true');
    nav.append(line); nav.classList.add('has-line');
    const links = [...nav.querySelectorAll('a')];
    const current = links.find((a) => a.getAttribute('aria-current') === 'page');
    const to = (a, show = true) => {
      if (!a) { line.style.setProperty('--o', 0); return; }
      const n = nav.getBoundingClientRect(); const r = a.getBoundingClientRect();
      line.style.setProperty('--x', `${r.left - n.left}px`); line.style.setProperty('--w', `${r.width}px`); line.style.setProperty('--o', show ? 1 : 0);
    };
    if (current) { line.style.transition = 'none'; to(current); requestAnimationFrame(() => { line.style.transition = ''; }); }
    links.forEach((a) => { a.addEventListener('pointerenter', () => to(a)); a.addEventListener('focus', () => to(a)); });
    nav.addEventListener('pointerleave', () => to(current));
    nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) to(current); });
    addEventListener('resize', () => to(current));
    document.fonts?.ready.then(() => to(current)); // the web font changes the links' widths
  }

  // ---------- language menu: folds back up when closed (a click elsewhere, Escape or its own button) ----------
  const langMenu = document.querySelector('.lang');
  if (langMenu) {
    const summary = langMenu.querySelector('summary');
    const close = () => {
      if (!langMenu.open || langMenu.classList.contains('is-closing')) return;
      if (reduce) { langMenu.open = false; return; }
      langMenu.classList.add('is-closing');
      langMenu.querySelector('.lang__menu').addEventListener('animationend', () => { langMenu.open = false; langMenu.classList.remove('is-closing'); }, { once: true });
    };
    summary.addEventListener('click', (e) => { if (langMenu.open) { e.preventDefault(); close(); } });
    summary.addEventListener('pointermove', (e) => { const r = summary.getBoundingClientRect(); summary.style.setProperty('--gx', `${e.clientX - r.left}px`); summary.style.setProperty('--gy', `${e.clientY - r.top}px`); });
    document.addEventListener('click', (e) => { if (!langMenu.contains(e.target)) close(); });
    langMenu.addEventListener('keydown', (e) => { if (e.key === 'Escape' && langMenu.open) { close(); summary.focus(); } });
  }

  // ---------- hero: pointing at a tile names its project under the title ----------
  const lede = document.querySelector('.hero__lede');
  if (lede) {
    let current = lede.dataset.default;
    const say = (text) => {
      if (text === current) return;
      current = text; lede.textContent = text;
      if (!reduce) lede.animate([{ opacity: 0, translate: '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    };
    const show = (a) => say(`${a.dataset.title} · ${a.dataset.meta}`);
    const reset = () => say(lede.dataset.default);
    document.querySelectorAll('.ring a').forEach((a) => {
      a.addEventListener('pointerenter', () => fine.matches && show(a));
      a.addEventListener('pointerleave', reset);
      a.addEventListener('focus', () => show(a));
      a.addEventListener('blur', reset);
    });
  }

  // ---------- hero: the tiles drift a little after the pointer, and a light follows it on each tile ----------
  const hero = document.querySelector('.hero');
  if (hero && !reduce) {
    let frame = 0; let px = 0; let py = 0;
    hero.addEventListener('pointermove', (e) => {
      if (!fine.matches) return;
      const r = hero.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1;
      const tile = e.target.closest('.ring a');
      if (tile) { const t = tile.getBoundingClientRect(); tile.style.setProperty('--gx', `${e.clientX - t.left}px`); tile.style.setProperty('--gy', `${e.clientY - t.top}px`); }
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; hero.style.setProperty('--mx', px.toFixed(3)); hero.style.setProperty('--my', py.toFixed(3)); });
    });
    hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', 0); hero.style.setProperty('--my', 0); });
  }

  // ---------- table of contents follows the reading position ----------
  const toc = document.querySelectorAll('.toc a');
  if (toc.length && 'IntersectionObserver' in window) {
    const map = new Map([...toc].map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { toc.forEach((a) => a.classList.remove('is-current')); map.get(e.target.id)?.classList.add('is-current'); }
    }, { rootMargin: '0px 0px -70% 0px' });
    map.forEach((_, id) => { const h = document.getElementById(id); if (h) io.observe(h); });
  }

  // ---------- language choice is remembered ----------
  document.querySelectorAll('[data-set-lang]').forEach((a) => a.addEventListener('click', () => {
    try { localStorage.setItem('lang', a.dataset.setLang); } catch (e) { /* private mode */ }
  }));

  // ---------- demo videos: play only on screen, never under reduced motion, always pausable ----------
  document.querySelectorAll('.vid').forEach((fig) => {
    const v = fig.querySelector('video'); const b = fig.querySelector('.vid__toggle');
    let userPaused = reduce;
    const label = () => { b.textContent = v.paused ? b.dataset.play : b.dataset.pause; };
    if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
    v.addEventListener('play', label); v.addEventListener('pause', label);
    b.addEventListener('click', () => { if (v.paused) { userPaused = false; v.play(); } else { userPaused = true; v.pause(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !userPaused) v.play().catch(() => {}); else if (!e.isIntersecting) v.pause();
    }, { threshold: 0.25 }).observe(fig);
    label();
  });

  // ---------- PDF reader ----------
  const dlg = document.querySelector('.viewer');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/';
  const wrap = dlg.querySelector('.viewer__pages-wrap');
  const status = dlg.querySelector('.viewer__status');
  const titleEl = dlg.querySelector('.viewer__title');
  const pagesEl = dlg.querySelector('.viewer__pages');
  const download = dlg.querySelector('.viewer__download');
  const fallback = dlg.querySelector('.viewer__fallback a');
  let lib = null; let doc = null; let pageObserver = null; let opener = null;

  async function loadLib() {
    if (!lib) {
      lib = await import(`${PDFJS}pdf.min.mjs`);
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
    }
    return lib;
  }

  async function renderPage(holder) {
    if (holder.dataset.done) return;
    holder.dataset.done = '1';
    const page = await doc.getPage(Number(holder.dataset.page));
    const base = page.getViewport({ scale: 1 });
    const scale = (holder.clientWidth * Math.min(2, devicePixelRatio || 1)) / base.width;
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
    canvas.setAttribute('aria-hidden', 'true');
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    holder.style.aspectRatio = '';
    holder.append(canvas);
  }

  async function open(src, title, startPage = 1) {
    titleEl.textContent = title; download.href = src; fallback.href = src;
    dlg.classList.remove('is-failed');
    wrap.replaceChildren(status); status.textContent = dlg.dataset.loading; pagesEl.textContent = '';
    dlg.showModal();
    try {
      const pdfjs = await loadLib();
      doc = await pdfjs.getDocument(src).promise;
      pagesEl.textContent = (dlg.dataset.pagesTemplate || '{n}').replace('{n}', doc.numPages);
      const first = await doc.getPage(1); const v = first.getViewport({ scale: 1 });
      status.remove();
      pageObserver = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { renderPage(e.target); pageObserver.unobserve(e.target); }
      }, { root: wrap, rootMargin: '600px 0px' });
      for (let i = 1; i <= doc.numPages; i++) {
        const holder = document.createElement('div');
        holder.className = 'viewer__page'; holder.dataset.page = i; holder.style.aspectRatio = `${v.width} / ${v.height}`;
        wrap.append(holder); pageObserver.observe(holder);
      }
      if (startPage > 1) wrap.children[startPage - 1]?.scrollIntoView({ block: 'start' });
    } catch (err) {
      status.textContent = dlg.dataset.failed;
      dlg.classList.add('is-failed');
    }
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-pdf]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    opener = a;
    open(a.dataset.pdf, a.dataset.pdfTitle || a.textContent.trim(), Number(a.dataset.pdfPage) || 1);
  });
  dlg.querySelector('.viewer__close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    pageObserver?.disconnect(); doc?.destroy(); doc = null;
    wrap.replaceChildren();
    opener?.focus();
  });
})();
