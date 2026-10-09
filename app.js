/* ==========================================================================
   Anirudh Devarakonda — portfolio behaviour
   --------------------------------------------------------------------------
   Modules (in boot order)
     utils ......... DOM helpers, formatting, images, modal stack, scroll lock
     smooth ........ Lenis smooth scroll driven by the GSAP ticker
     hud ........... SEM data-bar: section states, hover previews, MAG zoom
     hero .......... intro timeline + scroll-exit scrub
     reveals ....... generic [data-reveal], [data-split], [data-clip], rules
     about ......... headshot parallax
     timeline ...... experience trace + nodes
     sweep ......... pinned snap-in sequence, readouts, plot
     work .......... filters (Flip) + card → HUD previews
     caseStudy ..... overlay router, render, open/close (Flip), count-ups
     features ...... spectrum · detector · specs · pipeline · sweep-link
     lightbox ...... figure viewer: keys, swipe, zoom/pan, Flip
     nav ........... active section, hide/show, anchors, mobile menu
     contact ....... copy-to-clipboard
   All GSAP tweens use power3.out (scrubbed mappings use "none").
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     0. Environment
     ------------------------------------------------------------------------ */
  const doc = document;
  const root = doc.documentElement;
  const DATA = window.SITE_DATA;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const SplitText = window.SplitText;
  const Flip = window.Flip;
  const LenisCtor = window.Lenis;

  const HAS_GSAP = !!(gsap && ScrollTrigger);
  const HAS_FLIP = !!(HAS_GSAP && Flip);
  const HAS_SPLIT = !!(HAS_GSAP && SplitText);
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqMobile = window.matchMedia('(max-width: 759px)');
  const reduced = () => mqReduce.matches || !HAS_GSAP;
  const EASE = 'power3.out';

  /* ------------------------------------------------------------------------
     1. Utils
     ------------------------------------------------------------------------ */
  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad2 = (n) => String(n).padStart(2, '0');
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // The subset fonts have no U+2192, so arrows inside data strings become an inline SVG glyph.
  const ARROW_GLYPH =
    '<svg class="glyph-arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false"><path d="M0 5h14M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  const rich = (s) => esc(s).replace(/→/g, ARROW_GLYPH + '<span class="sr-only"> to </span>');
  const icon = (name) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  const CATEGORY = { nanofab: 'Nanofab', mems: 'MEMS', circuits: 'Circuits', architecture: 'Architecture' };
  // Cover focal points shared by the card and the case-study hero (QD: the blue, 436 nm end of the series).
  const COVER_POS = { qd: '0% 50%' };

  const PROJECTS = DATA ? DATA.projects.slice().sort((a, b) => a.order - b.order) : [];
  const BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

  /** True when any part of `el` is inside the viewport (optionally inset by `margin`). */
  function inViewport(el, margin = 0) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > margin && r.top < innerHeight - margin && r.right > 0 && r.left < innerWidth;
  }

  /** Move focus to a landmark/section without scrolling (adds tabindex=-1 when needed). */
  function focusQuietly(el) {
    if (!el) return;
    if (!el.hasAttribute('tabindex') && !el.matches('a[href], button, input, select, textarea')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }

  /** Image helpers built on the SITE_DATA manifest. */
  const Img = {
    get: (id) => DATA.images[id],
    pick(id, w = 800) {
      const ss = this.get(id).srcset;
      return ss.find((s) => s.w === w) || ss.find((s) => s.w >= w) || ss[ss.length - 1];
    },
    largest(id) {
      const ss = this.get(id).srcset;
      return ss[ss.length - 1];
    },
    srcset(id) {
      return this.get(id).srcset.map((s) => `${s.src} ${s.w}w`).join(', ');
    },
    /** Full <img> markup with real src/srcset/sizes, dimensions, lazy loading and data-asset. */
    html(id, { sizes = '100vw', cls = '', loading = 'lazy', w = 800, attrs = '' } = {}) {
      const im = this.get(id);
      if (!im) return '';
      const base = this.pick(id, w);
      const set = im.srcset.length > 1 ? ` srcset="${this.srcset(id)}" sizes="${sizes}"` : '';
      return `<img${cls ? ` class="${cls}"` : ''} src="${base.src}"${set} width="${base.w}" height="${base.h}" alt="${esc(im.alt)}" loading="${loading}" decoding="async" data-asset="${id}"${attrs ? ' ' + attrs : ''}>`;
    },
    /** Resolves once `src` is downloaded and decoded (never rejects). */
    preload(src, srcset, sizes) {
      return new Promise((resolve) => {
        const i = new Image();
        if (sizes) i.sizes = sizes;
        if (srcset) i.srcset = srcset;
        i.src = src;
        const done = () => resolve(i);
        if (i.decode) i.decode().then(done, done);
        else { i.onload = done; i.onerror = done; }
      });
    },
  };

  /** Stack of open dialogs: ESC closes the top one, Tab is trapped in it, the rest is inert. */
  const Modal = (() => {
    const stack = [];
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const background = () => [$('.skip-link'), $('#nav'), $('#main'), $('.footer')].filter(Boolean);
    const focusables = (el) =>
      $$(FOCUSABLE, el).filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');

    function push(entry) {
      const below = stack[stack.length - 1];
      if (below) below.el.inert = true;
      else background().forEach((n) => (n.inert = true));
      stack.push(entry);
    }
    function remove(entry) {
      const i = stack.indexOf(entry);
      if (i === -1) return;
      stack.splice(i, 1);
      const top = stack[stack.length - 1];
      if (top) top.el.inert = false;
      else background().forEach((n) => (n.inert = false));
    }
    doc.addEventListener('keydown', (e) => {
      const top = stack[stack.length - 1];
      if (!top) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        top.close();
        return;
      }
      if (e.key !== 'Tab') return;
      const f = focusables(top.el);
      if (!f.length) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      const active = doc.activeElement;
      if (e.shiftKey && (active === first || !top.el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !top.el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    });
    return { push, remove, top: () => stack[stack.length - 1], get isOpen() { return stack.length > 0; } };
  })();

  /* ------------------------------------------------------------------------
     2. Smooth scroll (Lenis) — one rAF: the GSAP ticker drives every instance
     ------------------------------------------------------------------------ */
  const Smooth = (() => {
    let lenis = null;
    const nested = new Set();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    function create() {
      if (lenis || reduced() || !LenisCtor) return;
      lenis = new LenisCtor({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      if (ScrollLock.locked) lenis.stop();
    }
    function destroy() {
      if (!lenis) return;
      lenis.destroy();
      lenis = null;
    }
    function init() {
      if (!HAS_GSAP) return;
      create();
      gsap.ticker.add((time) => {
        const ms = time * 1000;
        if (lenis) lenis.raf(ms);
        nested.forEach((l) => l.raf(ms));
      });
      gsap.ticker.lagSmoothing(0);
      mqReduce.addEventListener('change', () => (reduced() ? destroy() : create()));
    }
    const navOffset = () => -($('#nav')?.offsetHeight || 0);

    /** Scroll the page to an element/selector (Lenis when available, native otherwise). */
    function scrollTo(target, { immediate = false, offset, onComplete } = {}) {
      const el = typeof target === 'string' ? $(target) : target;
      if (!el) return;
      const off = offset ?? (el.id === 'top' ? 0 : navOffset());
      if (lenis) {
        lenis.scrollTo(el, { offset: off, immediate, force: true, duration: immediate ? 0 : 1.25, easing: easeOut, onComplete });
      } else {
        const y = el.id === 'top' ? 0 : el.getBoundingClientRect().top + window.scrollY + off;
        window.scrollTo(0, Math.max(0, y));
        if (onComplete) onComplete();
      }
    }
    return {
      init,
      scrollTo,
      stop: () => lenis && lenis.stop(),
      start: () => lenis && lenis.start(),
      add: (l) => nested.add(l),
      remove: (l) => nested.delete(l),
      get lenis() { return lenis; },
    };
  })();

  /** Reference-counted page scroll lock (menu, case study, lightbox). */
  const ScrollLock = (() => {
    let n = 0;
    return {
      lock() {
        if (n++ === 0) {
          Smooth.stop();
          root.classList.add('is-locked');
        }
      },
      unlock() {
        if (n > 0 && --n === 0) {
          root.classList.remove('is-locked');
          Smooth.start();
        }
      },
      get locked() { return n > 0; },
    };
  })();

  /* ------------------------------------------------------------------------
     3. HUD — SEM data bar
     ------------------------------------------------------------------------ */
  const HUD = (() => {
    const el = $('.hud');
    const STATES = {
      hero:       { mag: '×1,000,000', mode: '30.0 kV', label: 'QUANTUM DOT', value: '10 nm', bar: 56 },
      about:      { mag: '×1', mode: 'HUMAN', label: 'ENGINEER', value: '1.8 m', bar: 30 },
      experience: { mag: '×100,000', mode: 'FAB', label: 'TRANSISTOR GATE', value: '50 nm', bar: 44 },
      featured:   { mag: '×100', mode: 'OPTICAL', label: 'COMB DRIVE', value: '100 µm', bar: 66 },
      work:       { mag: '×1,000,000 → ×1', mode: '7 PROJECTS', label: '4 nm → SYSTEM', value: '', bar: 92 },
      contact:    { mag: '×1', mode: 'HUMAN', label: 'SAY HELLO', value: '1.8 m', bar: 30 },
    };
    if (!el) {
      const noop = () => {};
      return { init: noop, setSection: noop, preview: noop, release: noop, setZoom: noop, setZooming: noop, hide: noop, show: noop, intro: noop, STATES };
    }
    const text = $('.hud__text', el);
    const bg = $('.hud__bg', el);
    const bar = $('.hud__bar', el);
    const barLine = $('.hud__bar-line', el);
    const capR = $('.hud__cap--r', el);

    let section = 'hero';
    let previewId = null;
    let current = null;
    let zooming = false;
    let zoomText = STATES.hero.mag;
    let magEl = $('.hud__mag', el);

    const chunk = (v, mod = '') =>
      v
        ? `<span class="hud__chunk${mod ? ' hud__chunk--' + mod : ''}"><span class="hud__sep">·</span>${mod === 'scale' ? '<span class="hud__k hud__k--scale">SCALE:</span>' : ''}<span class="hud__v">${rich(v)}</span></span>`
        : '';
    const lineHTML = (s) =>
      `<span class="hud__k">MAG</span><span class="hud__v hud__mag">${rich(zooming ? zoomText : s.mag)}</span>` +
      chunk(s.mode, 'mode') + chunk(s.label, 'scale') + chunk(s.value);
    const same = (a, b) => a && b && a.mag === b.mag && a.mode === b.mode && a.label === b.label && a.value === b.value;

    // Geometry: the black box always ends 14px after the scale bar. Everything animates with
    // transforms only — the box scales from the left, the bar slides, the bar line scales.
    const PAD = 14;
    let barW = 0;
    const barMax = () => bar.offsetWidth || 96;
    const barPx = (px) => clamp(px * (barMax() / 96), 6, barMax());
    const visibleWidth = () => (mqMobile.matches ? el.offsetWidth : bar.offsetLeft + barW + PAD);

    function paintBar(animate) {
      const max = barMax();
      if (!HAS_GSAP) {
        barLine.style.transform = `scaleX(${barW / max})`;
        capR.style.transform = `translateX(${barW - 1.5}px)`;
        return;
      }
      const vars = { duration: animate ? 0.5 : 0, ease: EASE, overwrite: true };
      gsap.to(barLine, { scaleX: barW / max, ...vars });
      gsap.to(capR, { x: barW - 1.5, ...vars });
    }

    /** Run `mutate` (text swap / class change), then ease box + bar from the old geometry to the new one. */
    function geometry(mutate, nextBar, animate) {
      const vis0 = bg.getBoundingClientRect().width;
      const left0 = bar.getBoundingClientRect().left;
      mutate();
      if (nextBar != null) barW = barPx(nextBar);
      const W = el.offsetWidth || 1;
      const vis1 = visibleWidth();
      const left1 = el.getBoundingClientRect().left + bar.offsetLeft;
      if (!HAS_GSAP) {
        bg.style.transform = `scaleX(${vis1 / W})`;
        paintBar(false);
        return;
      }
      if (animate && vis0 > 0) {
        gsap.fromTo(bg, { scaleX: vis0 / W }, { scaleX: vis1 / W, duration: 0.5, ease: EASE, overwrite: true });
        if (Math.abs(left0 - left1) > 0.5) gsap.fromTo(bar, { x: left0 - left1 }, { x: 0, duration: 0.5, ease: EASE, overwrite: true });
      } else {
        gsap.set(bg, { scaleX: vis1 / W });
        gsap.set(bar, { x: 0 });
      }
      paintBar(animate);
    }

    /** Swap the whole line: old text slides/fades up, new text rises from below. */
    function render(state, animate = !reduced()) {
      if (same(state, current)) return;
      current = { ...state };
      const prev = $('.hud__line:not(.is-out)', text);
      const line = doc.createElement('span');
      line.className = 'hud__line';
      line.innerHTML = lineHTML(state);
      geometry(() => {
        if (prev) {
          if (animate) prev.classList.add('is-out');
          else prev.remove();
        }
        text.appendChild(line);
      }, state.bar, animate && !!prev);
      magEl = $('.hud__mag', line);
      if (!animate || !prev) return;
      gsap.to(prev, { yPercent: -110, autoAlpha: 0, duration: 0.5, ease: EASE, onComplete: () => prev.remove() });
      // The box and scale bar lead by a beat so the incoming text never overlaps the bar.
      gsap.fromTo(line, { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, delay: 0.07, ease: EASE });
    }

    return {
      STATES,
      init() {
        current = { ...STATES.hero };
        geometry(() => {}, STATES.hero.bar, false);
        const refit = () => geometry(() => {}, null, false);
        mqMobile.addEventListener('change', refit);
        window.addEventListener('resize', refit, { passive: true });
        if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refit);
      },
      setSection(name) {
        if (!STATES[name]) return;
        section = name;
        if (name !== 'work') previewId = null;
        if (!previewId) render(STATES[name]);
      },
      /** Card hover/focus: show the project's own scale. */
      preview(p) {
        previewId = p.id;
        render({ mag: p.scale.mag, mode: '', label: p.scale.label, value: p.scale.value, bar: 20 + p.order * 10 });
      },
      release(id) {
        if (previewId !== id) return;
        previewId = null;
        render(STATES[section]);
      },
      /** Hero exit scrub: MAG counts ×1,000,000 → ×1 on a log scale. */
      setZoom(progress) {
        const v = Math.max(1, Math.round(Math.pow(10, 6 * (1 - clamp(progress, 0, 1)))));
        zoomText = '×' + v.toLocaleString('en-US');
        if (zooming && magEl) magEl.textContent = zoomText;
      },
      setZooming(on) {
        if (on === zooming) return;
        geometry(() => {
          zooming = on;
          el.classList.toggle('is-zooming', on);
          if (!magEl) return;
          // onUpdate can fire before onToggle when a jump lands inside the range: sync the text here too.
          if (on) magEl.textContent = zoomText;
          else if (current) magEl.innerHTML = rich(previewId ? magEl.textContent : current.mag);
        }, null, !reduced());
      },
      hide() {
        if (!HAS_GSAP) return el.classList.add('is-hidden');
        gsap.to(el, { autoAlpha: 0, duration: reduced() ? 0 : 0.3, ease: EASE, overwrite: 'auto' });
      },
      show() {
        if (!HAS_GSAP) return el.classList.remove('is-hidden');
        gsap.to(el, { autoAlpha: 1, duration: reduced() ? 0 : 0.5, ease: EASE, overwrite: 'auto' });
      },
      el,
    };
  })();

  /* ------------------------------------------------------------------------
     4. Hero — intro timeline + scroll-exit scrub
     ------------------------------------------------------------------------ */
  const Hero = (() => {
    const hero = $('#top');
    let played = false;

    function reveal() {
      // Visible fallback state (reduced motion / missing plugins).
      $$('[data-intro]', hero).forEach((n) => (n.style.visibility = 'visible'));
      const tex = $('.hero__tex', hero);
      if (tex) tex.style.opacity = '';
      if (HUD.el) HUD.el.style.visibility = 'visible';
    }

    /** Plays once, after fonts are ready. Max ≈2.2 s. */
    function intro() {
      if (played || !hero) return;
      played = true;
      if (reduced() || !HAS_SPLIT) {
        reveal();
        return;
      }
      const tex = $('.hero__tex', hero);
      const lines = $$('.hero__line', hero);
      const name = $('.hero__name', hero);
      const textBlocks = $$('[data-intro-lines]', hero);
      const fades = [$('.hero__eyebrow', hero), $('.hero__meta', hero), $('.hero__ctas', hero), $('.hero__cue', hero)].filter(Boolean);

      const chars = SplitText.create(lines, { type: 'chars', mask: 'chars', charsClass: 'hero__char', aria: 'none' });
      gsap.set(name, { autoAlpha: 1 });

      const tl = gsap.timeline({ defaults: { ease: EASE } });
      tl.fromTo(tex, { opacity: 0, scale: 1.12 }, { opacity: 0.28, scale: 1, duration: 1.6 }, 0)
        .from(chars.chars, { yPercent: 115, duration: 1.1, stagger: 0.035 }, 0.1)
        .fromTo(fades, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.06 }, 0.95)
        .fromTo(HUD.el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 1.05);

      // Title + lede: masked lines, re-split on resize (autoSplit) with the tween returned from onSplit.
      SplitText.create(textBlocks, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'split-line',
        autoSplit: true,
        onSplit(self) {
          gsap.set(textBlocks, { autoAlpha: 1 });
          return gsap.from(self.lines, { yPercent: 100, duration: 1, ease: EASE, stagger: 0.08, delay: 0.45 });
        },
      });
    }

    /** Scroll exit: texture zooms out and fades, name lines drift up (line 2 faster), MAG counts down. */
    function scrub() {
      if (!hero) return;
      const bgEl = $('.hero__bg', hero);
      const [l1, l2] = $$('.hero__line', hero);
      const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: st })
        .to(bgEl, { scale: 0.86, opacity: 0, duration: 1 }, 0)
        .to(l1, { yPercent: -25, duration: 1 }, 0)
        .to(l2, { yPercent: -38, duration: 1 }, 0)
        .to([$('.hero__top', hero), $('.hero__bottom', hero), $('.hero__reticle', hero), $('.hero__cue-wrap', hero)].filter(Boolean), { opacity: 0, duration: 0.55 }, 0);
    }

    /** MAG zoom readout (runs with and without motion; it is text, not movement). */
    function zoomTrigger() {
      if (!hero || !HAS_GSAP) return;
      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => HUD.setZoom(self.progress),
        onToggle: (self) => HUD.setZooming(self.isActive),
      });
    }
    return { intro, scrub, reveal, zoomTrigger };
  })();

  /* ------------------------------------------------------------------------
     5. Reveals — [data-reveal] batch, [data-split] headings, [data-clip], rules
     ------------------------------------------------------------------------ */
  /** Mark revealed elements as at rest (CSS `.is-revealed`) and drop the inline tween values. */
  function settleReveal(els) {
    els.forEach((el) => el.classList.add('is-revealed'));
    gsap.set(els, { clearProps: 'opacity,transform' });
  }

  const Reveals = {
    motion() {
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 86%',
        once: true,
        onEnter: (batch) => {
          // A long jump (anchor link, deep link) can enter dozens of elements at once: anything already
          // above the viewport settles instantly, and the stagger for the rest is capped at ~0.6 s.
          const passed = batch.filter((el) => el.getBoundingClientRect().bottom < 0);
          const shown = batch.filter((el) => !passed.includes(el));
          if (passed.length) settleReveal(passed);
          if (!shown.length) return;
          gsap.to(shown, {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: EASE,
            stagger: Math.min(0.08, 0.6 / shown.length),
            overwrite: true,
            // Rest in a class, not inline styles: later Flip clean-ups can't resurrect the pre-reveal state.
            onComplete: () => settleReveal(shown),
          });
        },
      });

      $$('[data-split]').forEach((el) => {
        if (!HAS_SPLIT) {
          el.style.visibility = 'visible';
          return;
        }
        const chars = el.dataset.split === 'chars';
        SplitText.create(el, {
          type: chars ? 'lines,words,chars' : 'lines',
          mask: 'lines',
          linesClass: 'split-line',
          autoSplit: true,
          onSplit(self) {
            gsap.set(el, { visibility: 'visible' });
            return gsap.from(chars ? self.chars : self.lines, {
              yPercent: chars ? 110 : 100,
              duration: chars ? 0.9 : 1,
              ease: EASE,
              stagger: chars ? 0.018 : 0.08,
              scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            });
          },
        });
      });

      $$('[data-clip]').forEach((frame) => {
        const img = $('img', frame);
        const st = { trigger: frame, start: 'top 84%', once: true };
        gsap.to(frame, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: EASE, scrollTrigger: st });
        if (img) gsap.fromTo(img, { scale: frame.classList.contains('about__frame') ? 1.15 : 1.12 }, { scale: 1, duration: 1.2, ease: EASE, scrollTrigger: { ...st } });
      });

      $$('.section-rule').forEach((rule) =>
        gsap.to(rule, { scaleX: 1, duration: 1.4, ease: EASE, scrollTrigger: { trigger: rule, start: 'top 90%', once: true } })
      );
    },
  };

  /* ------------------------------------------------------------------------
     6. About — gentle scrubbed parallax on the headshot
     ------------------------------------------------------------------------ */
  const About = {
    motion() {
      const frame = $('.about__frame');
      const img = $('.about__img');
      if (!frame || !img) return;
      // The portrait is sticky, so measure against its (static) grid instead of the frame itself.
      const grid = frame.closest('.about__grid') || frame;
      gsap.fromTo(img, { yPercent: 0 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true } });
    },
  };

  /* ------------------------------------------------------------------------
     7. Timeline — accent trace scrubbed down the rail; nodes light up as it passes
     ------------------------------------------------------------------------ */
  const Timeline = {
    motion() {
      const wrap = $('.timeline');
      const trace = $('.timeline__trace');
      if (!wrap || !trace) return;
      gsap.fromTo(trace, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top 60%', end: 'bottom 60%', scrub: true } });
      $$('.tl', wrap).forEach((item) => {
        const node = $('.tl__node', item);
        ScrollTrigger.create({
          trigger: node,
          start: 'top 60%',
          onEnter: () => item.classList.add('is-reached'),
          onLeaveBack: () => item.classList.remove('is-reached'),
        });
      });
    },
  };

  /* ------------------------------------------------------------------------
     8. Sweep — pinned, scroll-scrubbed snap-in sequence
     ------------------------------------------------------------------------ */
  const Sweep = (() => {
    const S = DATA ? DATA.sweep : null;
    const stage = $('[data-snap-stage]');
    const plot = $('[data-plot]');
    if (!S || !stage || !plot) return { motion: () => {}, still: () => {} };

    const frames = $$('.snap__frame', stage);
    const ticks = $$('.snap__ticks li', stage);
    const fill = $('[data-snap-fill]', stage);
    const count = $('[data-snap-count]', stage);
    const ro = { bias: $('[data-ro="bias"]', stage), gap: $('[data-ro="gap"]', stage), state: $('[data-ro="state"]', stage) };
    const stateRow = ro.state.closest('.readout');
    const geom = JSON.parse(plot.dataset.geom);
    const line = $('.plot__line', plot);
    const cursor = $('.plot__cursor circle', plot);
    const guide = $('.plot__guide', plot);
    const pts = $$('.plot__pts circle', plot);

    const X = (v) => geom.x0 + (v / geom.vmax) * (geom.x1 - geom.x0);
    const Y = (g) => geom.y1 - ((g - geom.gmin) / (geom.gmax - geom.gmin)) * (geom.y1 - geom.y0);
    const P = S.volts.map((v, i) => [X(v), Y(S.gaps[i])]);
    const seg = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1]));
    const total = seg.reduce((a, b) => a + b, 0);
    const last = S.volts.length - 1;

    let lastIdx = -1;
    let snapped = null;

    /** Linear interpolation between measured keyframes for progress p ∈ [0, 1]. */
    function sample(p) {
      const t = clamp(p, 0, 1) * last;
      const k = Math.min(Math.floor(t), last - 1);
      const f = t - k;
      return { t, k, f, bias: lerp(S.volts[k], S.volts[k + 1], f), gap: lerp(S.gaps[k], S.gaps[k + 1], f) };
    }

    function setState(isSnap, animate) {
      ro.state.textContent = isSnap ? 'SNAP-IN' : 'STABLE · x ∝ V²';
      stateRow.classList.toggle('is-snapped', isSnap);
      plot.classList.toggle('is-snapped', isSnap);
      if (animate) gsap.fromTo(ro.state, { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: EASE, overwrite: true });
    }

    function render(p) {
      const s = sample(p);
      ro.bias.textContent = s.bias.toFixed(1);
      ro.gap.textContent = s.gap.toFixed(2);
      const isSnap = s.bias >= S.snapAt - 1e-9;
      if (isSnap !== snapped) {
        const first = snapped === null;
        snapped = isSnap;
        setState(isSnap, !first);
      }
      // Plot: the polyline is drawn exactly up to the cursor.
      const drawn = seg.slice(0, s.k).reduce((a, b) => a + b, 0) + seg[s.k] * s.f;
      line.style.strokeDashoffset = String(total - drawn);
      const cx = lerp(P[s.k][0], P[s.k + 1][0], s.f);
      const cy = lerp(P[s.k][1], P[s.k + 1][1], s.f);
      cursor.setAttribute('cx', cx.toFixed(2));
      cursor.setAttribute('cy', cy.toFixed(2));
      guide.setAttribute('x1', cx.toFixed(2));
      guide.setAttribute('x2', cx.toFixed(2));
      guide.setAttribute('y1', cy.toFixed(2));
      pts.forEach((c, i) => c.classList.toggle('is-on', i <= s.t + 1e-6));
      fill.style.transform = `scaleX(${clamp(p, 0, 1).toFixed(4)})`;
      const idx = Math.round(s.t);
      if (idx !== lastIdx) {
        lastIdx = idx;
        ticks.forEach((li, i) => li.classList.toggle('is-active', i === idx));
        count.textContent = `Frame ${idx + 1} / ${frames.length}`;
      }
    }

    function preload() {
      frames.forEach((f) => {
        const img = $('img', f);
        if (img && img.loading === 'lazy') img.loading = 'eager';
      });
    }

    /** Motion: pin + crossfade; frame i fully visible at progress i/5. */
    function motion(isDesktop) {
      line.style.strokeDasharray = String(total);
      ScrollTrigger.create({ trigger: stage, start: 'top bottom+=100%', once: true, onEnter: preload });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate() {
          render(this.progress());
        },
        scrollTrigger: {
          trigger: stage,
          pin: true,
          start: 'top top',
          end: isDesktop ? '+=250%' : '+=180%',
          scrub: 0.6,
          anticipatePin: 1,
          refreshPriority: 1,
          invalidateOnRefresh: true,
        },
      });
      frames.forEach((f, i) => {
        if (i) tl.fromTo(f, { opacity: 0 }, { opacity: 1, duration: 1 }, i - 1);
      });
      snapped = null;
      lastIdx = -1;
      render(0);
      return () => {
        line.style.strokeDasharray = '';
        line.style.strokeDashoffset = '';
      };
    }

    /** Reduced motion: static grid (CSS) + fully drawn plot. */
    function still() {
      line.style.strokeDasharray = '';
      line.style.strokeDashoffset = '';
      pts.forEach((c) => c.classList.add('is-on'));
      plot.classList.add('is-snapped');
    }
    return { motion, still, render };
  })();

  /* ------------------------------------------------------------------------
     9. Work — filters (Flip) + HUD previews + open case studies
     ------------------------------------------------------------------------ */
  const Work = (() => {
    const grid = $('[data-work-grid]');
    const cards = grid ? $$('.card', grid) : [];
    const chips = $$('[data-filter]');
    const status = $('[data-filter-status]');
    const GROUPS = { all: null, nanofab: ['qd', 'dsa', 'gfet'], mems: ['mems'], circuits: ['tia', 'sram'], architecture: ['rv32'] };
    // Column spans by number of visible cards (desktop ≥1100px / tablet 760–1099px).
    const LAYOUT = {
      lg: { 7: [7, 5, 4, 4, 4, 6, 6], 3: [4, 4, 4], 2: [6, 6], 1: [8] },
      md: { 7: [12, 6, 6, 6, 6, 6, 6], 3: [12, 6, 6], 2: [6, 6], 1: [12] },
    };
    const arLg = (s) => (s === 7 ? 1.892 : s === 8 ? 16 / 9 : 4 / 3);
    const arMd = (s) => (s === 12 ? 2 : 4 / 3);
    let active = 'all';
    let flip = null;

    const cardFor = (id) => cards.find((c) => c.dataset.project === id) || null;
    const isShown = (card) => !!card && !card.classList.contains('is-filtered-out');

    /** Explicit grid cells for a sequence of spans (12-column rows). */
    function placement(spans) {
      let row = 1;
      let col = 1;
      return spans.map((span) => {
        if (col + span - 1 > 12) {
          row += 1;
          col = 1;
        }
        const at = { row, col };
        col += span;
        return at;
      });
    }

    /** Every visible card gets an explicit cell per breakpoint, so taking one out of flow never reflows the rest. */
    function applyLayout(visible) {
      const n = visible.length;
      const lg = LAYOUT.lg[n] || visible.map(() => 4);
      const md = LAYOUT.md[n] || visible.map(() => 6);
      const pl = placement(lg);
      const pm = placement(md);
      visible.forEach((c, i) => {
        const st = c.style;
        st.setProperty('--span-lg', lg[i]);
        st.setProperty('--col-lg', pl[i].col);
        st.setProperty('--row-lg', pl[i].row);
        st.setProperty('--ar-lg', arLg(lg[i]).toFixed(3));
        st.setProperty('--span-md', md[i]);
        st.setProperty('--col-md', pm[i].col);
        st.setProperty('--row-md', pm[i].row);
        st.setProperty('--ar-md', arMd(md[i]).toFixed(3));
        st.setProperty('--row-sm', i + 1);
      });
    }

    /** Freeze the final row heights while cards are absolutely positioned (empty rows must not collapse). */
    function freezeRows(visible) {
      const rows = new Map();
      visible.forEach((c) => rows.set(c.offsetTop, Math.max(rows.get(c.offsetTop) || 0, c.offsetHeight)));
      grid.style.gridTemplateRows = [...rows.keys()].sort((a, b) => a - b).map((k) => `${rows.get(k)}px`).join(' ');
    }

    function filter(key) {
      if (!(key in GROUPS) || key === active) return;
      active = key;
      const ids = GROUPS[key];
      const show = (c) => !ids || ids.includes(c.dataset.project);
      const visible = cards.filter(show);
      chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === key)));
      if (status) status.textContent = `Showing ${visible.length} of ${cards.length} projects`;

      if (flip) flip.progress(1);
      const animate = HAS_FLIP && !reduced();
      if (HAS_GSAP) {
        // Once the grid is being filtered, scroll-reveals for cards are moot: retire their triggers and
        // normalise every card to a clean resting state so Flip measures (and restores) the truth.
        ScrollTrigger.getAll().forEach((t) => cards.includes(t.trigger) && t.kill());
        gsap.killTweensOf(cards);
        settleReveal(cards);
        gsap.set(cards, { clearProps: 'opacity,transform,translate,scale,rotate' });
      }
      const before = new Set(cards.filter((c) => !c.classList.contains('is-filtered-out')));
      const state = animate ? Flip.getState(cards) : null;
      // Current visual height (possibly mid-tween), then release it so the new natural height can be measured.
      const h0 = grid.offsetHeight;
      if (HAS_GSAP) gsap.killTweensOf(grid);
      grid.style.height = '';
      grid.style.gridTemplateRows = '';
      cards.forEach((c) => c.classList.toggle('is-filtered-out', !show(c)));
      applyLayout(visible);
      if (!animate) {
        if (HAS_GSAP) ScrollTrigger.refresh();
        return;
      }
      const h1 = grid.offsetHeight;
      freezeRows(visible);
      const staying = visible.filter((c) => before.has(c));
      const entering = visible.filter((c) => !before.has(c));
      const leaving = cards.filter((c) => before.has(c) && !show(c));
      const settle = () => {
        grid.style.height = '';
        grid.style.gridTemplateRows = '';
        flip = null;
        ScrollTrigger.refresh();
      };
      // Leaving cards fade first, staying cards glide to their new cells, entering cards rise in last.
      flip = Flip.from(state, {
        targets: [...staying, ...leaving],
        duration: 0.7,
        ease: EASE,
        absolute: true,
        zIndex: 2,
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.97, duration: 0.28, ease: EASE }),
      });
      if (entering.length) {
        gsap.fromTo(entering, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: EASE, delay: 0.28, stagger: 0.06, clearProps: 'opacity,transform' });
      }
      // The grid keeps (and eases) its height while cards are out of flow; the height tween owns the clean-up.
      gsap.fromTo(grid, { height: h0 }, { height: h1, duration: 0.8, ease: EASE, onComplete: settle });
    }

    function init() {
      if (!grid) return;
      chips.forEach((b) => b.addEventListener('click', () => filter(b.dataset.filter)));
      cards.forEach((card) => {
        const p = BY_ID[card.dataset.project];
        if (!p) return;
        const on = () => HUD.preview(p);
        const off = () => HUD.release(p.id);
        card.addEventListener('mouseenter', on);
        card.addEventListener('mouseleave', off);
        card.addEventListener('focus', on);
        card.addEventListener('blur', off);
        card.addEventListener('click', (e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          CaseStudy.open(p.id, { from: card });
        });
      });
    }
    return { init, cardFor, isShown, filter };
  })();

  /* ------------------------------------------------------------------------
     10. Features — modules rendered inside a case study
     ------------------------------------------------------------------------ */

  /** Approximate visible colour for a wavelength (Bruton), gamma 0.8, slightly softened. */
  function wavelengthColor(w) {
    let r = 0, g = 0, b = 0;
    if (w < 440) { r = -(w - 440) / 60; b = 1; }
    else if (w < 490) { g = (w - 440) / 50; b = 1; }
    else if (w < 510) { g = 1; b = -(w - 510) / 20; }
    else if (w < 580) { r = (w - 510) / 70; g = 1; }
    else if (w < 645) { r = 1; g = -(w - 645) / 65; }
    else { r = 1; }
    const k = 0.9;
    const c = (v) => Math.round(255 * Math.pow(clamp(v, 0, 1) * k, 0.8));
    return `rgb(${c(r)} ${c(g)} ${c(b)})`;
  }

  const Spectrum = {
    MIN: 420,
    MAX: 600,
    ACCENT: 436.33,
    pct(w) { return ((w - this.MIN) / (this.MAX - this.MIN)) * 100; },
    html(f) {
      const stops = [];
      for (let w = this.MIN; w <= this.MAX; w += 5) stops.push(`${wavelengthColor(w)} ${this.pct(w).toFixed(2)}%`);
      let ticks = '';
      for (let w = this.MIN; w <= this.MAX; w += 20) ticks += `<span class="spectrum__tick" style="left:${this.pct(w)}%">${w}</span>`;
      const peaks = f.peaks
        .map((w) => {
          const accent = Math.abs(w - this.ACCENT) < 0.005;
          return `<span class="spectrum__peak${accent ? ' is-accent' : ''}" style="--x:${this.pct(w).toFixed(3)}%"><span class="spectrum__pin"></span><span class="spectrum__val">${w}</span></span>`;
        })
        .join('');
      const label = `Visible spectrum from 420 to 600 nm with the six measured photoluminescence peaks: ${f.peaks.join(', ')} nm. The 436.33 nm peak is this site’s accent colour.`;
      return `
        <section class="cs__feature container feat" aria-labelledby="feat-title" data-feature="spectrum">
          <div class="cs__section-head" data-cs-in><h3 class="feat__kicker" id="feat-title">Emission spectrum</h3><p class="feat__note">${esc(f.note)}</p></div>
          <div class="spectrum" role="img" aria-label="${esc(label)}">
            <div class="spectrum__track">
              <span class="spectrum__unit" aria-hidden="true">Wavelength · nm</span>
              <div class="spectrum__peaks" aria-hidden="true">${peaks}</div>
              <div class="spectrum__bar" aria-hidden="true" style="background:linear-gradient(90deg, ${stops.join(', ')})"></div>
              <div class="spectrum__ticks" aria-hidden="true">${ticks}</div>
              <p class="spectrum__callout" aria-hidden="true" style="--x:${this.pct(this.ACCENT).toFixed(3)}%"><span>436.33 nm — this site’s accent</span></p>
            </div>
          </div>
        </section>`;
    },
    /** Stack value labels into tiers so that no label overlaps another label or another peak's pin. */
    layout(section) {
      const track = $('.spectrum__track', section);
      if (!track) return;
      const W = track.clientWidth;
      const GAP = 8;
      const placed = [];
      $$('.spectrum__peak', section).forEach((peak) => {
        const val = $('.spectrum__val', peak);
        const x = (parseFloat(peak.style.getPropertyValue('--x')) / 100) * W;
        const w = val.offsetWidth;
        const left = clamp(x - w / 2, -4, W - w + 4);
        const right = left + w;
        val.style.left = `${(left - x).toFixed(1)}px`;
        val.style.transform = 'none';
        const clash = (t) =>
          placed.some((p) =>
            (p.tier === t && left < p.right + GAP && right > p.left - GAP) || // same row
            (p.tier < t && x > p.left - 4 && x < p.right + 4) ||             // my pin crosses a lower label
            (p.tier > t && p.x > left - 4 && p.x < right + 4)                // a taller pin crosses my label
          );
        let tier = 0;
        while (clash(tier) && tier < 6) tier++;
        placed.push({ x, left, right, tier });
        peak.style.setProperty('--tier', tier);
      });
    },
    mount(section, ctx) {
      this.layout(section);
      const ro = new ResizeObserver(() => this.layout(section));
      ro.observe($('.spectrum__track', section));
      ctx.cleanups.push(() => ro.disconnect());
      if (reduced()) return;
      const peaks = $$('.spectrum__peak', section);
      const callout = $('.spectrum__callout', section);
      gsap.set(peaks, { y: -18, opacity: 0 });
      gsap.set(callout, { opacity: 0, y: 8 });
      ctx.triggers.push(
        ScrollTrigger.create({
          trigger: $('.spectrum', section),
          scroller: ctx.scroller,
          start: 'top 82%',
          once: true,
          onEnter: () => {
            gsap.to(peaks, { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09 });
            gsap.to(callout, { opacity: 1, y: 0, duration: 0.8, ease: EASE, delay: 0.6 });
          },
        })
      );
    },
  };

  const Detector = {
    label(caption) {
      const m = /\(([a-i])\)\s*([^.]+)\./.exec(caption || '');
      return m ? `(${m[1]}) ${m[2].trim()}` : '';
    },
    html(p) {
      const f = p.feature;
      const tiles = f.tiles
        .map((t, i) => {
          const sem = `dsa-sem-${t}`;
          const afm = `dsa-afm-${t}`;
          const label = this.label(Img.get(sem).caption);
          return `<li><button class="tile__btn" type="button" data-tile="${i}" aria-label="Enlarge ${esc(label)}">
              <span class="tile__stack">${Img.html(sem, { sizes: '(min-width: 1100px) 320px, 31vw', attrs: 'data-mode="sem"' })}${Img.html(afm, { sizes: '(min-width: 1100px) 320px, 31vw', attrs: 'data-mode="afm"' })}</span>
              <span class="tile__label">${esc(label)}</span></button></li>`;
        })
        .join('');
      return `
        <section class="cs__feature container feat detector" data-mode="sem" aria-labelledby="feat-title" data-feature="detector">
          <div class="cs__section-head" data-cs-in><h3 class="feat__kicker" id="feat-title">Detector</h3><p class="feat__note">Nine templates · trenches (a–f) and wells (g–i)</p></div>
          <div class="detector__grid">
            <div class="detector__tiles">
              <ul class="tiles">${tiles}</ul>
              <p class="feat__note detector__note">${esc(f.note)}.</p>
            </div>
            <div class="detector__panel">
              <div class="seg" role="group" aria-label="Detector">
                <button class="seg__btn" type="button" data-detector="sem" aria-pressed="true">SEM</button>
                <button class="seg__btn" type="button" data-detector="afm" aria-pressed="false">AFM</button>
              </div>
              <div class="detector__reading" aria-hidden="true">
                <p class="detector__k" data-det-k>READING</p>
                <p class="detector__t" data-det-t>Hover or focus a template to read what it shows; select it to enlarge.</p>
              </div>
            </div>
          </div>
        </section>`;
    },
    setMode(section, mode) {
      if (!section || section.dataset.mode === mode) return;
      section.dataset.mode = mode;
      $$('[data-detector]', section).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.detector === mode)));
      const afm = $$('.tile__stack img[data-mode="afm"]', section);
      $$('.tile__btn', section).forEach((b) => {
        const lbl = $('.tile__label', b).textContent;
        b.setAttribute('aria-label', `Enlarge ${lbl} (${mode.toUpperCase()})`);
      });
      const to = mode === 'afm' ? 1 : 0;
      if (reduced()) afm.forEach((i) => (i.style.opacity = String(to)));
      else gsap.to(afm, { opacity: to, duration: 0.5, ease: EASE, stagger: 0.04, overwrite: true });
    },
    ids(section) {
      const mode = section.dataset.mode || 'sem';
      return BY_ID.dsa.feature.tiles.map((t) => `dsa-${mode}-${t}`);
    },
    /** Show the full caption of the hovered/focused template in the side panel. */
    read(tile) {
      const section = tile.closest('.detector');
      if (!section) return;
      const id = this.ids(section)[+tile.dataset.tile];
      const cap = Img.get(id).caption.replace(/^(SEM|AFM)\s*/, '');
      const m = /^(\([a-i]\)[^.]+)\.\s*(.*)$/.exec(cap);
      $('[data-det-k]', section).textContent = `${(section.dataset.mode || 'sem').toUpperCase()} · ${m ? m[1] : ''}`;
      $('[data-det-t]', section).textContent = m ? m[2] : cap;
    },
  };

  const Specs = {
    CAP: 2.6,
    html(f) {
      const rows = f.rows
        .map((r) => {
          let margin;
          if (r.ratio == null) {
            margin = '<span class="specs__dc">DC-coupled</span>';
          } else {
            const shown = Math.min(r.ratio, this.CAP);
            const over = ((shown - 1) / this.CAP) * 100;
            margin = `<span class="mbar"><span class="mbar__track"><span class="mbar__base"></span><span class="mbar__over" style="width:${over.toFixed(2)}%"></span><span class="mbar__spec"></span>${r.ratio > this.CAP ? '<span class="mbar__cap"></span>' : ''}</span><span class="mbar__x">${r.ratio.toFixed(2)}×</span></span>`;
          }
          return `<tr role="row"><th scope="row" role="rowheader">${esc(r.param)}</th><td role="cell" data-label="Required">${esc(r.spec)}</td><td role="cell" class="is-achieved" data-label="Achieved">${esc(r.result)}</td><td role="cell" class="specs__margin">${margin}</td></tr>`;
        })
        .join('');
      return `
        <section class="cs__feature container feat" aria-labelledby="feat-title" data-feature="specs">
          <div class="cs__section-head" data-cs-in><h3 class="feat__kicker" id="feat-title">Specification vs. result</h3><p class="feat__note">${esc(f.note)}</p></div>
          <div class="specs-wrap">
            <table class="specs" role="table">
              <caption class="sr-only">${esc(f.note)}. Margin is achieved over required (or required over achieved for upper limits).</caption>
              <thead><tr role="row"><th scope="col" role="columnheader">Parameter</th><th scope="col" role="columnheader">Required</th><th scope="col" role="columnheader">Achieved</th><th scope="col" role="columnheader" class="specs__margin">Margin</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p class="specs__legend" aria-hidden="true"><span><i style="background:var(--line-2)"></i>Up to spec (1×)</span><span><i style="background:var(--accent)"></i>Margin above spec</span><span>Bar scale capped at 2.6×</span></p>
        </section>`;
    },
    mount(section, ctx) {
      if (reduced()) return;
      const base = $$('.mbar__base', section);
      const over = $$('.mbar__over', section);
      gsap.set([...base, ...over], { scaleX: 0 });
      ctx.triggers.push(
        ScrollTrigger.create({
          trigger: $('.specs', section),
          scroller: ctx.scroller,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.to(base, { scaleX: 1, duration: 0.7, ease: EASE, stagger: 0.07 });
            gsap.to(over, { scaleX: 1, duration: 0.9, ease: EASE, stagger: 0.07, delay: 0.35 });
          },
        })
      );
    },
  };

  const Pipeline = {
    X: [96, 248, 400, 552, 704],
    NAMES: ['IF', 'ID', 'EX', 'MEM', 'WB'],
    SUBS: ['Fetch', 'Decode', 'Execute', 'Memory', 'Writeback'],
    // Illustrative instruction stream that exercises each bypass path.
    PROG: [
      { op: 'add', args: 'x1, x2, x3', note: '' },
      { op: 'sub', args: 'x4, x1, x5', note: 'x1 via MX' },
      { op: 'and', args: 'x6, x1, x7', note: 'x1 via WX' },
      { op: 'or', args: 'x8, x9, x10', note: '' },
      { op: 'xor', args: 'x11, x4, x12', note: 'x4 via WD' },
    ],
    // beat → [arc, dependent instruction index, producer index]
    HOT: { 3: ['mx', 1, 0], 4: ['wx', 2, 0], 5: ['wd', 4, 1] },
    svg() {
      const stages = this.X.map(
        (x, i) => `<g class="stage"><rect x="${x - 58}" y="112" width="116" height="116" rx="4"/><text x="${x}" y="140">${this.NAMES[i]}</text><text class="sub" x="${x}" y="210">${this.SUBS[i].toUpperCase()}</text></g>`
      ).join('');
      const regs = [172, 324, 476, 628].map((x) => `<line class="preg" x1="${x}" x2="${x}" y1="100" y2="240"/>`).join('');
      const toks = this.PROG.map((_, i) => `<g class="tok" data-tok="${i}" transform="translate(-60 175)"><rect x="-24" y="-13" width="48" height="26" rx="13"/><text x="0" y="0">I${i + 1}</text></g>`).join('');
      return `<svg class="pipe__svg" viewBox="0 0 800 330" role="img" aria-label="Five-stage RV32IM pipeline: IF, ID, EX, MEM, WB, with MX, WX and WD bypass paths; instructions I1 to I5 advance one stage per cycle.">
          <defs><marker id="pipe-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" fill="context-stroke"/></marker></defs>
          <g class="arc" data-arc="mx"><path d="M552 112 C552 66 412 66 412 106" marker-end="url(#pipe-arrow)"/><text x="482" y="70">MX</text></g>
          <g class="arc" data-arc="wx"><path d="M704 112 C704 22 388 22 388 106" marker-end="url(#pipe-arrow)"/><text x="546" y="40">WX</text></g>
          <g class="arc" data-arc="wd"><path d="M704 228 C704 316 248 316 248 234" marker-end="url(#pipe-arrow)"/><text x="476" y="300">WD</text></g>
          ${regs}${stages}${toks}
        </svg>`;
    },
    html(p) {
      const prog = this.PROG.map(
        (ins, i) => `<li data-ins="${i}"><b>I${i + 1}</b><span>${ins.op} ${ins.args}</span>${ins.note ? `<em>${ins.note}</em>` : '<span></span>'}</li>`
      ).join('');
      return `
        <div class="pipe" data-pipe>
          <span class="pipe__holder"><span class="pipe__frame" data-flip-id="cover-${p.id}">${this.svg()}</span></span>
          <div class="pipe__controls" data-cs-in>
            <p class="pipe__legend">${esc(p.feature.note)} · illustrative instruction stream</p>
            ${reduced() ? '' : `<button class="btn-ghost" type="button" data-pipe-toggle>${icon('pause')}<span>Pause</span></button>`}
          </div>
          <ol class="pipe__prog" aria-label="Illustrative instruction stream" data-cs-in>${prog}</ol>
        </div>`;
    },
    /** Places tokens for a given beat (static snapshot or animation keyframe). */
    snapshot(root, beat) {
      $$('.tok', root).forEach((tok, k) => {
        const s = beat - k;
        const x = s < 0 ? -60 : s > 4 ? 860 : this.X[s];
        tok.setAttribute('transform', `translate(${x} 175)`);
      });
      this.setHot(root, beat);
    },
    setHot(root, beat) {
      const hot = this.HOT[beat];
      $$('.arc', root).forEach((a) => a.classList.toggle('is-hot', !!hot && a.dataset.arc === hot[0]));
      $$('.tok', root).forEach((t, k) => t.classList.toggle('is-dep', !!hot && (k === hot[1] || k === hot[2])));
      $$('.pipe__prog li', root).forEach((li, k) => li.classList.toggle('is-hot', !!hot && k === hot[1]));
    },
    mount(root, ctx) {
      if (!root) return;
      if (reduced()) {
        this.snapshot(root, 4);
        return;
      }
      const toks = $$('.tok', root);
      const step = 0.6;
      const beatLen = 0.95;
      gsap.set(toks, { x: -60, y: 175, opacity: 1 });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.9, paused: true });
      tl.set(toks, { x: -60, opacity: 1 }, 0).call(() => this.setHot(root, -1), null, 0);
      for (let b = 0; b <= 9; b++) {
        const t = 0.25 + b * beatLen;
        toks.forEach((tok, k) => {
          const s = b - k;
          if (s >= 0 && s <= 4) tl.to(tok, { x: this.X[s], duration: step, ease: EASE }, t);
          else if (s === 5) tl.to(tok, { x: 860, opacity: 0, duration: step, ease: EASE }, t);
        });
        tl.call(() => this.setHot(root, b), null, t + step * 0.65);
      }
      tl.call(() => this.setHot(root, -1), null, 0.25 + 10 * beatLen);
      ctx.timelines.push(tl);
      const btn = $('[data-pipe-toggle]', root);
      const sync = () => {
        if (!btn) return;
        const paused = tl.paused();
        btn.innerHTML = `${icon(paused ? 'play' : 'pause')}<span>${paused ? 'Play' : 'Pause'}</span>`;
        btn.setAttribute('aria-label', paused ? 'Play pipeline animation' : 'Pause pipeline animation');
      };
      if (btn) {
        btn.addEventListener('click', () => {
          tl.paused(!tl.paused());
          sync();
        });
      }
      gsap.delayedCall(1.0, () => {
        if (!ctx.dead) tl.play();
      });
      sync();
    },
  };

  const SweepLink = {
    html(f) {
      return `
        <section class="cs__feature container feat" aria-label="Snap-in sequence" data-feature="sweep-link">
          <div class="sweep-link" data-cs-in>
            <p>${esc(f.note)}</p>
            <button class="btn-ghost" type="button" data-goto-snap>Watch the snap-in sequence ${icon('arrow-u')}</button>
          </div>
        </section>`;
    },
  };

  /* ------------------------------------------------------------------------
     11. Case study overlay
     ------------------------------------------------------------------------ */
  const CaseStudy = (() => {
    const el = $('#case');
    if (!el || !DATA) return { init() {}, open() {}, get isOpen() { return false; } };
    const scroller = $('[data-case-scroller]', el);
    const content = $('[data-case-content]', el);
    const crumb = $('[data-case-crumb]', el);
    const backdrop = $('.case__backdrop', el);
    const bar = $('.case__bar', el);
    const progress = $('.case__progress', el);
    const COUNT_RE = /^([+−-]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/;

    let s = { open: false, closing: false, id: null, source: null, returnFocus: null };
    let ctx = null; // per-render resources: triggers, timelines, cleanups
    let inner = null; // nested Lenis for the overlay scroller
    let lbItems = [];
    let afterClose = null;
    const modal = { el, close: () => requestClose() };

    const parseHash = () => {
      const m = /^#project\/([\w-]+)$/.exec(location.hash);
      return m ? m[1] : null;
    };
    const galleryIds = (p) => p.images.filter((id) => id !== p.cover && !['sem', 'afm'].includes(Img.get(id)?.group));

    /* ---------- Render ---------- */
    function heroHTML(p) {
      if (!p.cover) {
        return `<figure class="cs__hero cs__hero--pipe container" data-cs-hero aria-label="Pipeline diagram">${Pipeline.html(p)}</figure>`;
      }
      const im = Img.get(p.cover);
      const ar = im.width / im.height;
      const tall = ar < 1.4;
      const base = Img.pick(p.cover, 800);
      const sizes = tall ? '(min-width: 760px) 60vw, 100vw' : '(min-width: 1500px) 1400px, 94vw';
      return `
        <figure class="cs__hero container${tall ? ' cs__hero--tall' : ''}" data-cs-hero style="--ar:${ar.toFixed(4)}">
          <button class="cs__hero-btn" type="button" data-lb-open="0" aria-label="Enlarge figure: ${esc(im.alt)}">
            <span class="cs__hero-frame mat--${im.kind}" data-flip-id="cover-${p.id}">
              <img src="${base.src}" width="${base.w}" height="${base.h}" alt="${esc(im.alt)}" decoding="async" data-asset="${p.cover}" data-hires-sizes="${sizes}"${COVER_POS[p.id] ? ` style="--pos:${COVER_POS[p.id]}"` : ''}>
              <span class="cs__hero-zoom">${icon('zoom')}</span>
            </span>
          </button>
          <figcaption class="cs__hero-cap" data-cs-in>${esc(im.caption)}<span class="fig__id">${esc(p.cover)}</span></figcaption>
        </figure>`;
    }

    function metricHTML(m) {
      const countable = COUNT_RE.test(m.value);
      const joined = m.unit && m.unit.startsWith('-');
      const num = countable
        ? `<span class="metric__num" data-count="${esc(m.value)}"><span class="sr-only">${esc(m.value)}</span><span class="metric__ghost" aria-hidden="true">${esc(m.value)}</span><span class="metric__live" aria-hidden="true">${esc(m.value)}</span></span>`
        : `<span class="metric__num">${rich(m.value)}${joined ? `<span class="metric__suffix">${esc(m.unit)}</span>` : ''}</span>`;
      const unit = m.unit && !joined ? `<span class="metric__unit">${esc(m.unit)}</span>` : '';
      return `<div class="metric" data-cs-in><p class="metric__value">${num}${unit}</p><p class="metric__label">${esc(m.label)}</p></div>`;
    }

    function featureHTML(p) {
      const f = p.feature;
      if (!f) return '';
      switch (f.type) {
        case 'spectrum': return Spectrum.html(f);
        case 'detector': return Detector.html(p);
        case 'specs': return Specs.html(f);
        case 'sweep-link': return SweepLink.html(f);
        case 'pipeline': return ''; // shown in the hero slot (no cover image)
        default: return '';
      }
    }

    function figureHTML(id, index) {
      const im = Img.get(id);
      if (!im) return '';
      return `
        <figure class="fig fig--${im.kind}" data-cs-fig>
          <button class="fig__btn" type="button" data-lb-open="${index}" aria-label="Enlarge figure: ${esc(im.alt)}">
            <span class="fig__mat">${Img.html(id, { sizes: '(min-width: 1100px) 30vw, (min-width: 640px) 46vw, 100vw' })}</span>
          </button>
          <figcaption>${esc(im.caption)}<span class="fig__id">${esc(id)}</span></figcaption>
        </figure>`;
    }

    function galleryHTML(ids, offset) {
      if (!ids.length) return '';
      return `
        <section class="cs__gallery container" aria-labelledby="cs-figures">
          <div class="cs__section-head" data-cs-in><h3 class="feat__kicker" id="cs-figures">Figures · ${pad2(ids.length)}</h3><p class="feat__note">Select a figure to enlarge it.</p></div>
          <div class="gallery">${ids.map((id, i) => figureHTML(id, i + offset)).join('')}</div>
        </section>`;
    }

    function footHTML(p) {
      const i = PROJECTS.indexOf(p);
      const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length];
      const next = PROJECTS[(i + 1) % PROJECTS.length];
      return `
        <nav class="container" aria-label="More projects" data-cs-in>
          <div class="cs__foot">
            <a class="cs__nav-link" href="#project/${prev.id}" data-case-goto="${prev.id}"><span class="k">${icon('arrow-l')}Previous project</span><span class="t">${esc(prev.title)}</span></a>
            <button class="btn-ghost" type="button" data-case-close>Close ${icon('close')}</button>
            <a class="cs__nav-link cs__nav-link--next" href="#project/${next.id}" data-case-goto="${next.id}"><span class="k">Next project${icon('arrow-r')}</span><span class="t">${esc(next.title)}</span></a>
          </div>
        </nav>`;
    }

    function render(p) {
      const withLine = p.withNote ? esc(p.withNote) : p.with.length ? `With <b>${p.with.map(esc).join(', ')}</b>` : '';
      const gallery = galleryIds(p);
      lbItems = [p.cover, ...gallery].filter(Boolean);
      return `
        <article class="cs" data-project="${p.id}">
          <header class="cs__head container">
            <div class="cs__head-main">
              <p class="cs__kicker" data-cs-in>Project <b>${pad2(p.order)}</b> / ${pad2(PROJECTS.length)} · ${esc(p.course)}</p>
              <h2 class="cs__title" id="case-title" tabindex="-1" data-cs-in>${esc(p.title)}</h2>
              <p class="cs__subtitle" data-cs-in>${esc(p.subtitle)}</p>
            </div>
            <div class="cs__facts" data-cs-in>
              <p class="scale-chip"><span class="scale-chip__v">${esc(p.scale.value)}</span><span class="scale-chip__l">${esc(p.scale.label)}</span><span class="scale-chip__m">${rich(p.scale.mag)}${p.scale.mag.toLowerCase() === p.category ? '' : ` · ${CATEGORY[p.category]}`}</span></p>
              ${withLine ? `<p class="cs__with">${withLine}</p>` : ''}
            </div>
          </header>
          ${heroHTML(p)}
          <section class="container" aria-label="Key results"><div class="cs__metrics" style="--n:${p.metrics.length}">${p.metrics.map(metricHTML).join('')}</div></section>
          <section class="cs__text container" aria-label="Overview">
            <p class="cs__lead" data-cs-in>${esc(p.summary)}</p>
            <div class="cs__body" data-cs-in>${p.body.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
          </section>
          ${featureHTML(p)}
          ${galleryHTML(gallery, 1)}
          ${footHTML(p)}
        </article>`;
    }

    /* ---------- Mount / unmount ---------- */
    function mount(p) {
      content.innerHTML = render(p);
      crumb.innerHTML = `Work <span aria-hidden="true">/</span> <b>${pad2(p.order)}</b> <span class="case__crumb-t">${esc(p.title)}</span>`;
      ctx = { dead: false, scroller, triggers: [], timelines: [], cleanups: [] };
    }

    /** Runs once content is in place and visible: features, reading progress, gallery reveals, hi-res hero. */
    function activate(p) {
      if (!ctx) return;
      const motion = !reduced();
      if (motion) {
        const pr = gsap.fromTo(progress, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { scroller, trigger: content, start: 'top top', end: 'bottom bottom', scrub: true } });
        ctx.triggers.push(pr.scrollTrigger);
        const figs = $$('[data-cs-fig]', content);
        if (figs.length) {
          gsap.set(figs, { opacity: 0, y: 32 });
          ctx.triggers.push(
            ...ScrollTrigger.batch(figs, {
              scroller,
              start: 'top 94%',
              once: true,
              onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.08, overwrite: true }),
            })
          );
        }
      }
      const f = p.feature;
      const section = $('[data-feature]', content);
      if (f && f.type === 'spectrum' && section) Spectrum.mount(section, ctx);
      if (f && f.type === 'specs' && section) Specs.mount(section, ctx);
      if (f && f.type === 'pipeline') Pipeline.mount($('[data-pipe]', content), ctx);
      upgradeHero();
      if (motion) ScrollTrigger.refresh();
    }

    function upgradeHero() {
      const img = $('.cs__hero-frame img', content);
      if (!img) return;
      const id = img.dataset.asset;
      const sizes = img.dataset.hiresSizes;
      const set = Img.srcset(id);
      Img.preload(Img.pick(id).src, set, sizes).then(() => {
        if (!img.isConnected) return;
        img.sizes = sizes;
        img.srcset = set;
      });
    }

    function teardown() {
      if (!ctx) return;
      ctx.dead = true;
      ctx.triggers.forEach((t) => t && t.kill && t.kill());
      ctx.timelines.forEach((t) => t.kill());
      ctx.cleanups.forEach((fn) => fn());
      ctx = null;
      if (HAS_GSAP) gsap.killTweensOf(progress);
      if (progress) progress.style.transform = '';
    }

    function createInnerLenis() {
      if (reduced() || !LenisCtor || inner) return;
      inner = new LenisCtor({ wrapper: scroller, content, lerp: 0.1, smoothWheel: true });
      inner.on('scroll', ScrollTrigger.update);
      Smooth.add(inner);
    }
    function destroyInnerLenis() {
      if (!inner) return;
      Smooth.remove(inner);
      inner.destroy();
      inner = null;
    }
    const scrollTop = () => {
      if (inner) inner.scrollTo(0, { immediate: true, force: true });
      scroller.scrollTop = 0;
    };

    /* ---------- Count-ups ---------- */
    function countUp(delay = 0.35) {
      if (reduced()) return;
      $$('[data-count]', content).forEach((el, i) => {
        const raw = el.dataset.count;
        const m = COUNT_RE.exec(raw);
        const live = $('.metric__live', el);
        if (!m || !live) return;
        const sign = m[1];
        const commas = m[2].includes(',');
        const dec = m[3] ? m[3].length - 1 : 0;
        const target = parseFloat(m[2].replace(/,/g, '') + (m[3] || ''));
        const fmt = (v) =>
          sign + (commas ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec));
        const o = { v: 0 };
        live.textContent = fmt(0);
        gsap.to(o, {
          v: target,
          duration: 1.2,
          ease: EASE,
          delay: delay + i * 0.08,
          onUpdate: () => (live.textContent = fmt(o.v)),
          onComplete: () => (live.textContent = raw),
        });
      });
    }

    /* ---------- Open ---------- */
    function open(id, { from = null, push = true, flip = true } = {}) {
      const p = BY_ID[id];
      if (!p) return;
      if (s.open) {
        if (id !== s.id) swap(id);
        return;
      }
      if (Nav.menuOpen) Nav.closeMenu({ restoreFocus: false });
      const card = from || Work.cardFor(id);
      s = { open: true, closing: false, id, source: card, returnFocus: from || card || doc.activeElement };
      if (push) history.pushState({ case: id }, '', `#project/${id}`);

      mount(p);
      el.hidden = false;
      ScrollLock.lock();
      Modal.push(modal);
      HUD.hide();
      createInnerLenis();
      scrollTop();
      $('#case-title', content)?.focus({ preventScroll: true });

      const media = card ? $('.card__media', card) : null;
      const target = $('[data-flip-id]', content);
      const items = $$('[data-cs-in], .cs__metrics .metric', content).filter((n, i, a) => a.indexOf(n) === i);

      if (reduced()) {
        activate(p);
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: EASE }, onComplete: () => activate(p) });
      tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0)
        .fromTo(bar, { yPercent: -100 }, { yPercent: 0, duration: 0.7 }, 0.15)
        .fromTo(items, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.05 }, 0.22);
      const canFlip = flip && HAS_FLIP && media && target && inViewport(media) && Work.isShown(card);
      if (canFlip) {
        const state = Flip.getState(media);
        card.classList.add('is-source');
        tl.add(Flip.from(state, { targets: target, duration: 0.95, ease: EASE, absolute: true, zIndex: 4 }), 0);
      } else {
        const hero = $('[data-cs-hero]', content);
        if (hero) tl.fromTo(hero, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9 }, 0.25);
      }
      countUp(0.45);
    }

    /* ---------- Prev / next inside the overlay ---------- */
    function swap(id) {
      const p = BY_ID[id];
      if (!p || !s.open || s.closing) return;
      const keep = history.state && history.state.case ? { case: id } : null;
      history.replaceState(keep, '', `#project/${id}`);
      const prevSource = s.source;
      const go = () => {
        teardown();
        prevSource?.classList.remove('is-source');
        s.id = id;
        s.source = Work.cardFor(id);
        mount(p);
        scrollTop();
        $('#case-title', content)?.focus({ preventScroll: true });
      };
      if (reduced()) {
        go();
        activate(p);
        return;
      }
      gsap
        .timeline({ defaults: { ease: EASE } })
        .to(content, { opacity: 0, y: -16, duration: 0.3 })
        .add(go)
        .set(content, { y: 0, opacity: 1 })
        .add(() => {
          const items = $$('[data-cs-in], .cs__metrics .metric, [data-cs-hero]', content);
          gsap.fromTo(items, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.05, onComplete: () => activate(p) });
          countUp(0.3);
        });
    }

    /* ---------- Close ---------- */
    /** UI close (button, ESC, footer): go back through history so Back/Forward stay coherent. */
    function requestClose(then) {
      if (!s.open || s.closing) return;
      if (then) afterClose = then;
      if (history.state && history.state.case) history.back(); // → popstate → close()
      else {
        history.replaceState(null, '', location.pathname + location.search);
        close();
      }
    }

    function close() {
      if (!s.open || s.closing) return;
      s.closing = true;
      if (Lightbox.isOpen) Lightbox.close({ instant: true });
      const card = Work.cardFor(s.id);
      const usable = card && Work.isShown(card);
      const media = usable ? $('.card__media', card) : null;
      const frame = $('[data-flip-id]', content);
      const motion = !reduced();
      let unlocked = false;

      // Bring the card into view behind the overlay so the image can fly home (deep links, prev/next).
      if (motion && media && !inViewport(media, 40)) {
        ScrollLock.unlock();
        unlocked = true;
        gsap.set(card, { opacity: 1, y: 0 });
        Smooth.scrollTo(card, { immediate: true, offset: -Math.max(80, (innerHeight - card.offsetHeight) / 2) });
      }
      const frameRect = frame ? frame.getBoundingClientRect() : null;
      const canFlip = motion && HAS_FLIP && media && frame && frameRect.bottom > -innerHeight * 0.6 && inViewport(media);

      const finish = () => {
        teardown();
        destroyInnerLenis();
        el.hidden = true;
        content.innerHTML = '';
        if (HAS_GSAP) gsap.set([backdrop, bar, content], { clearProps: 'all' });
        card?.classList.remove('is-source');
        s.source?.classList.remove('is-source');
        Modal.remove(modal);
        if (!unlocked) ScrollLock.unlock();
        HUD.show();
        const focusTarget = usable ? card : s.returnFocus;
        s = { open: false, closing: false, id: null, source: null, returnFocus: null };
        if (focusTarget && focusTarget.isConnected) focusTarget.focus({ preventScroll: true });
        if (HAS_GSAP) ScrollTrigger.update();
        const next = afterClose;
        afterClose = null;
        if (next) next();
      };

      if (!motion) {
        finish();
        return;
      }
      const rest = $$('.cs > *', content).filter((n) => !n.contains(frame));
      const heroCap = $('.cs__hero-cap', content);
      const pipeExtras = $$('.pipe__controls, .pipe__prog', content);
      const tl = gsap.timeline({ defaults: { ease: EASE }, onComplete: finish });
      tl.to([...rest, heroCap, ...pipeExtras].filter(Boolean), { opacity: 0, duration: 0.3 }, 0).to(bar, { yPercent: -100, duration: 0.5 }, 0);
      if (canFlip) {
        card.classList.add('is-source');
        tl.add(Flip.fit(frame, media, { duration: 0.85, ease: EASE, absolute: true }), 0.05).to(backdrop, { opacity: 0, duration: 0.55 }, 0.25);
      } else {
        tl.to(content, { opacity: 0, y: 24, duration: 0.4 }, 0).to(backdrop, { opacity: 0, duration: 0.5 }, 0.1);
      }
    }

    /* ---------- Events ---------- */
    function init() {
      el.addEventListener('click', (e) => {
        const t = e.target;
        const closeBtn = t.closest('[data-case-close]');
        if (closeBtn) {
          e.preventDefault();
          requestClose();
          return;
        }
        const go = t.closest('[data-case-goto]');
        if (go) {
          e.preventDefault();
          swap(go.dataset.caseGoto);
          return;
        }
        const lb = t.closest('[data-lb-open]');
        if (lb) {
          Lightbox.open(lbItems, +lb.dataset.lbOpen, lb);
          return;
        }
        const tile = t.closest('.tile__btn');
        if (tile) {
          const section = tile.closest('.detector');
          Lightbox.open(Detector.ids(section), +tile.dataset.tile, tile);
          return;
        }
        const det = t.closest('[data-detector]');
        if (det) {
          Detector.setMode(det.closest('.detector'), det.dataset.detector);
          return;
        }
        if (t.closest('[data-goto-snap]')) requestClose(() => Smooth.scrollTo('#snap-in', { onComplete: () => focusQuietly($('#snap-in')) }));
      });

      const readTile = (e) => {
        const tile = e.target.closest && e.target.closest('.tile__btn');
        if (tile) Detector.read(tile);
      };
      el.addEventListener('mouseover', readTile);
      el.addEventListener('focusin', readTile);

      window.addEventListener('popstate', () => {
        const id = parseHash();
        if (id && BY_ID[id]) {
          if (!s.open) open(id, { push: false, flip: false });
          else if (id !== s.id) swap(id);
        } else if (s.open) close();
      });
    }

    /** Deep link on load: land the page on the work grid, then open over it. */
    function boot() {
      const id = parseHash();
      if (!id || !BY_ID[id]) return;
      Smooth.scrollTo('#work', { immediate: true });
      open(id, { push: false, flip: false });
    }

    return { init, boot, open, requestClose, get isOpen() { return s.open; } };
  })();

  /* ------------------------------------------------------------------------
     12. Lightbox
     ------------------------------------------------------------------------ */
  const Lightbox = (() => {
    const el = $('#lightbox');
    if (!el || !DATA) return { open() {}, close() {}, get isOpen() { return false; } };
    const stage = $('[data-lb-stage]', el);
    const zoomBtn = $('[data-lb-zoom]', el);
    // The viewer image is created here (an <img> without src would be invalid in the static markup).
    const img = doc.createElement('img');
    img.className = 'lb__img';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    zoomBtn.appendChild(img);
    const counter = $('[data-lb-counter]', el);
    const caption = $('[data-lb-caption]', el);
    const asset = $('[data-lb-asset]', el);
    const prevBtn = $('[data-lb-prev]', el);
    const nextBtn = $('[data-lb-next]', el);
    const closeBtn = $('[data-lb-close]', el);
    const backdrop = $('.lb__backdrop', el);
    const info = $('.lb__info', el);

    let items = [];
    let index = 0;
    let opener = null;
    let isOpen = false;
    let zoomed = false;
    let token = 0;
    const pan = { x: 0, y: 0 };
    const modal = { el, close: () => close() };

    /** The image the user actually sees inside an opener (detector tiles stack SEM + AFM). */
    const thumbOf = (node) => {
      if (!node) return null;
      const det = node.closest('.detector');
      if (det) return $(`img[data-mode="${det.dataset.mode || 'sem'}"]`, node);
      return $('img', node);
    };

    function setZoom(on, e) {
      zoomed = on;
      zoomBtn.setAttribute('aria-pressed', String(on));
      zoomBtn.setAttribute('aria-label', on ? 'Zoom out' : 'Zoom image');
      pan.x = 0;
      pan.y = 0;
      if (on && e && e.pointerType === 'mouse') panTo(e, true);
      else if (HAS_GSAP) gsap.to(img, { scale: on ? 2 : 1, x: 0, y: 0, duration: reduced() ? 0 : 0.5, ease: EASE, overwrite: true });
      else img.style.transform = on ? 'scale(2)' : '';
    }

    /** Mouse: the point under the cursor stays in view while zoomed. */
    function panTo(e, animate) {
      const r = zoomBtn.getBoundingClientRect();
      const rx = clamp((e.clientX - r.left) / r.width, 0, 1);
      const ry = clamp((e.clientY - r.top) / r.height, 0, 1);
      pan.x = (0.5 - rx) * r.width;
      pan.y = (0.5 - ry) * r.height;
      if (HAS_GSAP) gsap.to(img, { scale: 2, x: pan.x, y: pan.y, duration: animate && !reduced() ? 0.5 : 0.25, ease: EASE, overwrite: true });
    }

    function update(dir = 0, from = null) {
      const id = items[index];
      const im = Img.get(id);
      const big = Img.largest(id);
      const my = ++token;
      setZoom(false);
      const thumb = thumbOf(from);
      img.alt = im.alt;
      img.width = big.w;
      img.height = big.h;
      img.dataset.asset = id;
      img.src = thumb && thumb.currentSrc ? thumb.currentSrc : Img.pick(id).src;
      Img.preload(big.src).then(() => {
        if (my === token && isOpen) img.src = big.src;
      });
      counter.textContent = `${pad2(index + 1)} / ${pad2(items.length)}`;
      caption.textContent = im.caption;
      asset.textContent = id;
      const single = items.length < 2;
      prevBtn.hidden = single;
      nextBtn.hidden = single;
      if (!single) {
        [items[(index + 1) % items.length], items[(index - 1 + items.length) % items.length]].forEach((n) => Img.preload(Img.largest(n).src));
      }
      if (dir && HAS_GSAP && !reduced()) {
        gsap.fromTo(img, { opacity: 0, x: dir * 48 }, { opacity: 1, x: 0, duration: 0.55, ease: EASE, overwrite: true });
      }
    }

    function go(step) {
      if (items.length < 2) return;
      index = (index + step + items.length) % items.length;
      update(step);
    }

    function open(list, i, from) {
      if (!list || !list.length) return;
      items = list.slice();
      index = clamp(i, 0, items.length - 1);
      opener = from || doc.activeElement;
      isOpen = true;
      el.hidden = false;
      Modal.push(modal);
      ScrollLock.lock();
      update(0, from);
      zoomBtn.focus({ preventScroll: true });
      if (!HAS_GSAP || reduced()) return;
      const thumb = thumbOf(from);
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: EASE });
      gsap.fromTo([info, prevBtn, nextBtn, closeBtn], { opacity: 0 }, { opacity: 1, duration: 0.5, ease: EASE, delay: 0.15 });
      if (HAS_FLIP && thumb && inViewport(thumb)) {
        el.classList.add('is-flipping');
        img.dataset.flipId = 'lb-active';
        thumb.dataset.flipId = 'lb-active';
        const state = Flip.getState(thumb);
        delete thumb.dataset.flipId;
        Flip.from(state, {
          targets: img,
          duration: 0.6,
          ease: EASE,
          scale: true,
          onComplete: () => el.classList.remove('is-flipping'),
        });
      } else {
        gsap.fromTo(img, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.5, ease: EASE });
      }
    }

    function close({ instant = false } = {}) {
      if (!isOpen) return;
      isOpen = false;
      token++;
      const back = opener;
      const finish = () => {
        el.hidden = true;
        el.classList.remove('is-flipping');
        if (HAS_GSAP) gsap.set([img, backdrop, info, prevBtn, nextBtn, closeBtn], { clearProps: 'all' });
        img.removeAttribute('src');
        Modal.remove(modal);
        ScrollLock.unlock();
        if (back && back.isConnected && !instant) back.focus({ preventScroll: true });
      };
      if (instant || !HAS_GSAP || reduced()) {
        finish();
        return;
      }
      setZoom(false);
      const thumb = thumbOf(back);
      gsap.to([info, prevBtn, nextBtn, closeBtn], { opacity: 0, duration: 0.25, ease: EASE });
      gsap.to(backdrop, { opacity: 0, duration: 0.45, ease: EASE, delay: 0.1 });
      if (HAS_FLIP && thumb && inViewport(thumb) && items[index] === thumb.dataset.asset) {
        el.classList.add('is-flipping');
        Flip.fit(img, thumb, { duration: 0.55, ease: EASE, scale: true, onComplete: finish });
      } else {
        gsap.to(img, { opacity: 0, scale: 0.96, duration: 0.4, ease: EASE, onComplete: finish });
      }
    }

    function init() {
      prevBtn.addEventListener('click', () => go(-1));
      nextBtn.addEventListener('click', () => go(1));
      closeBtn.addEventListener('click', () => close());
      $('[data-lb-close-backdrop]', el).addEventListener('click', () => close());

      doc.addEventListener('keydown', (e) => {
        if (!isOpen || Modal.top() !== modal) return;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(-1);
        }
      });

      // Pointer: swipe to navigate, click to zoom, mouse-follow / drag to pan.
      let down = null;
      let moved = false;
      stage.addEventListener('pointerdown', (e) => {
        if (!isOpen || (e.pointerType === 'mouse' && e.button !== 0)) return;
        down = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, id: e.pointerId };
        moved = false;
      });
      stage.addEventListener('pointermove', (e) => {
        if (!isOpen) return;
        if (zoomed && e.pointerType === 'mouse') {
          panTo(e, false);
          return;
        }
        if (!down || e.pointerId !== down.id) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > 8) moved = true;
        if (zoomed) {
          const r = zoomBtn.getBoundingClientRect();
          pan.x = clamp(down.px + dx, -r.width / 2, r.width / 2);
          pan.y = clamp(down.py + dy, -r.height / 2, r.height / 2);
          gsap.set(img, { x: pan.x, y: pan.y });
        }
      });
      const end = (e) => {
        if (!down || e.pointerId !== down.id) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (!zoomed && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        down = null;
      };
      stage.addEventListener('pointerup', end);
      stage.addEventListener('pointercancel', () => (down = null));
      zoomBtn.addEventListener('click', (e) => {
        if (moved) {
          moved = false;
          return;
        }
        setZoom(!zoomed, e);
      });
      // Clicking the empty stage (outside the image) closes.
      stage.addEventListener('click', (e) => {
        if (!moved && e.target === stage) close();
      });
    }

    return { init, open, close, get isOpen() { return isOpen; } };
  })();

  /* ------------------------------------------------------------------------
     13. Nav — active section, hide on scroll down, anchors, mobile menu
     ------------------------------------------------------------------------ */
  const Nav = (() => {
    const nav = $('#nav');
    const links = $$('[data-nav]', nav || doc);
    const menu = $('#menu');
    const menuBtn = $('.nav__menu-btn');
    let hidden = false;
    let menuOpen = false;
    let current = null;
    const modal = { el: menu, close: () => closeMenu() };

    function setActive(id) {
      current = id;
      links.forEach((a) => (a.dataset.nav === id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
    function show() {
      if (!hidden || !HAS_GSAP) return;
      hidden = false;
      gsap.to(nav, { yPercent: 0, duration: 0.6, ease: EASE, overwrite: true });
    }
    function hide() {
      if (hidden || !HAS_GSAP) return;
      hidden = true;
      gsap.to(nav, { yPercent: -110, duration: 0.6, ease: EASE, overwrite: true });
    }

    function triggers() {
      if (!HAS_GSAP || !nav) return;
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate(self) {
          const y = self.scroll();
          nav.classList.toggle('is-scrolled', y > 24);
          if (reduced() || menuOpen || Modal.isOpen) return show();
          if (y < 160 || self.direction < 0) show();
          else hide();
        },
      });
      [['#about', 'about'], ['#experience', 'experience'], ['#snap-in', 'work'], ['#work', 'work'], ['#contact', 'contact']].forEach(([sel, id]) => {
        if (!$(sel)) return;
        ScrollTrigger.create({
          trigger: sel,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: (self) => {
            if (self.isActive) setActive(id);
            else if (current === id) setActive(null);
          },
        });
      });
    }

    function openMenu() {
      if (menuOpen || !menu) return;
      menuOpen = true;
      menu.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      Modal.push(modal);
      ScrollLock.lock();
      $('[data-menu-close]', menu).focus({ preventScroll: true });
      if (!HAS_GSAP || reduced()) return;
      gsap.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: EASE });
      gsap.fromTo($$('.menu__label', menu), { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: EASE, stagger: 0.07, delay: 0.05 });
      gsap.fromTo([...$$('.menu__num', menu), $('.menu__foot', menu)], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: EASE, stagger: 0.04, delay: 0.25 });
    }
    function closeMenu({ restoreFocus = true } = {}) {
      if (!menuOpen) return;
      menuOpen = false;
      menuBtn.setAttribute('aria-expanded', 'false');
      Modal.remove(modal);
      ScrollLock.unlock();
      const finish = () => {
        menu.hidden = true;
        if (restoreFocus) menuBtn.focus({ preventScroll: true });
      };
      if (!HAS_GSAP || reduced()) finish();
      else gsap.to(menu, { autoAlpha: 0, duration: 0.35, ease: EASE, onComplete: finish });
    }

    const focusTarget = (el) => focusQuietly(el.id === 'top' ? $('#main') : el);

    function init() {
      if (menuBtn) menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
      $('[data-menu-close]', menu || doc)?.addEventListener('click', () => closeMenu());
      mqMobile.addEventListener('change', (e) => {
        if (!e.matches) closeMenu({ restoreFocus: false });
      });
      // In-page anchors → smooth scroll with nav offset (case-study links are handled elsewhere).
      doc.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="#"]');
        if (!a || e.defaultPrevented || a.closest('#case')) return;
        const href = a.getAttribute('href');
        if (href.length < 2 || href.startsWith('#project/')) return;
        const target = $(href);
        if (!target) return;
        e.preventDefault();
        if (menuOpen) closeMenu({ restoreFocus: false });
        Smooth.scrollTo(target, { onComplete: () => focusTarget(target) });
      });
    }
    return {
      init,
      triggers,
      closeMenu,
      show,
      get menuOpen() { return menuOpen; },
    };
  })();

  /* ------------------------------------------------------------------------
     14. Contact — copy email
     ------------------------------------------------------------------------ */
  const Contact = {
    init() {
      const btn = $('[data-copy]');
      if (!btn) return;
      const label = $('[data-copy-label]');
      const status = $('[data-copy-status]');
      let timer = 0;
      const legacy = (text) => {
        const ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        doc.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = doc.execCommand('copy'); } catch (_) { ok = false; }
        ta.remove();
        return ok;
      };
      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy;
        let ok = false;
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            ok = true;
          }
        } catch (_) { ok = false; }
        if (!ok) ok = legacy(text);
        clearTimeout(timer);
        label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
        status.textContent = ok ? 'Email address copied to clipboard' : 'Copy failed. Select the address to copy it.';
        btn.classList.toggle('is-done', ok);
        if (!ok) {
          const r = doc.createRange();
          r.selectNodeContents($('.contact__mail'));
          const sel = getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        }
        timer = setTimeout(() => {
          label.textContent = 'Copy';
          status.textContent = '';
          btn.classList.remove('is-done');
        }, 1600);
      });
    },
  };

  /* ------------------------------------------------------------------------
     15. Boot
     ------------------------------------------------------------------------ */
  function run(name, fn) {
    try {
      return fn();
    } catch (err) {
      console.error(`[site] ${name} failed:`, err);
      return undefined;
    }
  }

  /** Re-measure triggers after late image loads: always for images inside pinned/sticky regions (spec),
      otherwise only if the page height actually changed. Never while a pinned section is active. */
  function watchLazyImages() {
    let height = root.scrollHeight;
    let timer = 0;
    let forced = false;
    const check = (force) => {
      forced = forced || force;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const h = root.scrollHeight;
        if (!forced && h === height) return;
        if (ScrollTrigger.getAll().some((t) => t.pin && t.isActive)) return check(false);
        forced = false;
        height = h;
        ScrollTrigger.refresh();
      }, 250);
    };
    const pinned = new Set($$('[data-snap-stage] img, .timeline img, .about__frame img'));
    $$('#main img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', () => check(pinned.has(img)), { once: true });
    });
  }

  function boot() {
    if (!DATA || !HAS_GSAP) {
      // Content is static HTML; without the libraries just make sure nothing stays hidden.
      root.classList.remove('motion-ok');
      window.__siteBooted = true;
      if (DATA) {
        run('work', Work.init);
        run('case', CaseStudy.init);
        run('lightbox', Lightbox.init);
        run('nav', Nav.init);
        run('contact', Contact.init);
        run('router', CaseStudy.boot);
      }
      return;
    }
    gsap.registerPlugin(...[ScrollTrigger, SplitText, Flip].filter(Boolean));
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (!HAS_SPLIT) $$('[data-split]').forEach((n) => (n.style.visibility = 'visible'));

    run('smooth', Smooth.init);
    run('hud', HUD.init);
    run('nav', Nav.init);
    run('work', Work.init);
    run('case', CaseStudy.init);
    run('lightbox', Lightbox.init);
    run('contact', Contact.init);

    const mm = gsap.matchMedia();
    // Breakpoint-dependent pinning/scrubbing (created first: it is highest on the page that pins).
    mm.add(
      { motionOK: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)', desktop: '(min-width: 760px)', mobile: '(max-width: 759px)' },
      (c) => {
        const { motionOK, desktop } = c.conditions;
        if (!motionOK) {
          run('sweep:still', Sweep.still);
          return undefined;
        }
        const undo = run('sweep', () => Sweep.motion(desktop));
        ScrollTrigger.sort();
        return undo;
      }
    );
    // Motion-only effects.
    mm.add({ motionOK: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (c) => {
      root.classList.toggle('motion-ok', !!c.conditions.motionOK);
      if (!c.conditions.motionOK) {
        Hero.reveal();
        return undefined;
      }
      run('hero:scrub', Hero.scrub);
      run('about', About.motion);
      run('timeline', Timeline.motion);
      run('reveals', Reveals.motion);
      return undefined;
    });

    // Always-on scroll bindings (text state, not movement).
    run('hero:zoom', Hero.zoomTrigger);
    run('hud:triggers', () => {
      [['#top', 'hero'], ['#about', 'about'], ['#experience', 'experience'], ['#snap-in', 'featured'], ['#work', 'work'], ['#contact', 'contact']].forEach(([sel, name]) => {
        if (!$(sel)) return;
        ScrollTrigger.create({ trigger: sel, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && HUD.setSection(name) });
      });
    });
    run('nav:triggers', Nav.triggers);

    window.__site = {
      get lenis() { return Smooth.lenis; },
      ScrollTrigger,
      gsap,
      openProject: (id) => CaseStudy.open(id),
      filter: (key) => Work.filter(key),
    };
    window.__siteBooted = true;

    const fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      run('hero:intro', Hero.intro);
      ScrollTrigger.refresh();
    });
    window.addEventListener('load', () => ScrollTrigger.refresh());
    run('lazy-refresh', watchLazyImages);
    run('router', CaseStudy.boot);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
