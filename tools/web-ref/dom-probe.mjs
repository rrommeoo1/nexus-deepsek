// Runs INSIDE the page (Playwright serialises it). Returns every visible element that intersects the
// viewport: geometry, exact text, inline SVG, computed styles and state. Text-only, no images.
export function DOM_PROBE() {
  const clamp = (s, n) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim().slice(0, n));
  const skip = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'HEAD', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'G', 'DEFS', 'STOP', 'USE', 'TEXT', 'TSPAN']);
  const nodes = [];
  const vh = innerHeight;
  let i = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (skip.has(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) continue;
    if (r.bottom < -120 || r.top > vh + 120) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    if (i > 2600) break;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
    const svg = el.querySelector(':scope > svg');
    const data = {};
    for (const a of el.attributes) if (a.name.startsWith('data-') && Object.keys(data).length < 8) data[a.name] = clamp(a.value, 60);
    nodes.push({
      n: i++,
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      cls: [...el.classList].slice(0, 6).join(' '),
      role: el.getAttribute('role') || undefined,
      text: clamp(own, 220) || undefined,
      aria: clamp(el.getAttribute('aria-label'), 120) || undefined,
      title: clamp(el.getAttribute('title'), 120) || undefined,
      ph: clamp(el.getAttribute('placeholder'), 80) || undefined,
      alt: clamp(el.getAttribute('alt'), 80) || undefined,
      href: clamp(el.getAttribute('href'), 160) || undefined,
      type: el.getAttribute('type') || undefined,
      name: el.getAttribute('name') || undefined,
      val: el.tagName === 'INPUT' && el.type === 'password' ? '[redacted]' : clamp(el.value, 80) || undefined,
      disabled: el.hasAttribute('disabled') ? true : undefined,
      selv: el.getAttribute('aria-selected') || undefined,
      exp: el.getAttribute('aria-expanded') || undefined,
      data: Object.keys(data).length ? data : undefined,
      r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      svg: svg ? clamp(svg.outerHTML, 700) : undefined,
      s: {
        d: cs.display,
        pos: cs.position,
        z: cs.zIndex,
        bg: cs.backgroundColor,
        bgi: clamp(cs.backgroundImage, 90),
        color: cs.color,
        ff: clamp(cs.fontFamily, 70),
        fs: cs.fontSize,
        fw: cs.fontWeight,
        lh: cs.lineHeight,
        ls: cs.letterSpacing,
        ta: cs.textAlign,
        tt: cs.textTransform,
        m: cs.margin,
        p: cs.padding,
        bd: cs.borderWidth + ' ' + cs.borderStyle + ' ' + cs.borderColor,
        br: cs.borderRadius,
        sh: clamp(cs.boxShadow, 90),
        op: cs.opacity,
        ov: cs.overflow,
        flex: (cs.flexDirection || '') + ' ' + (cs.justifyContent || '') + ' ' + (cs.alignItems || '') + ' g:' + cs.gap,
        tr: clamp(cs.transform, 70),
        tran: clamp(cs.transition, 130),
        anim: clamp(cs.animation, 130),
        bf: clamp(cs.backdropFilter, 60),
        w: cs.width,
        h: cs.height,
      },
    });
  }
  const lines = [...new Set(document.body.innerText.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean))];
  return {
    viewport: {
      w: innerWidth,
      h: innerHeight,
      dpr: devicePixelRatio,
      scrollY: Math.round(scrollY),
      docH: document.documentElement.scrollHeight,
      title: document.title,
    },
    nodeCount: nodes.length,
    nodes,
    textLines: lines.slice(0, 400),
    counts: {
      buttons: document.querySelectorAll('button').length,
      svgs: document.querySelectorAll('svg').length,
      imgs: document.querySelectorAll('img').length,
      inputs: document.querySelectorAll('input').length,
    },
  };
}
