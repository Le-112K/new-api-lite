/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useRef } from 'react'

/**
 * ApertureGlobe — the rotating dot-field earth that anchors the Aperture hero.
 *
 * The land is real: Natural Earth 110m coastlines rasterised into a 256x128
 * 1bpp mask (base64, ~5.5 KB), sampled with a Fibonacci sphere distribution so
 * point density stays uniform on the sphere instead of piling up at the poles.
 * Points are projected orthographically with a fixed 26° tilt and spun at one
 * revolution per 32 s, linear — the earth rotates at a constant rate, so easing
 * it would read as wrong.
 *
 * Everything is drawn in `--foreground`, re-read whenever the theme flips, so
 * the field follows light/dark without any colour literal in this file.
 *
 * Ported from the approved prototype (`deliverables/aperture-landing.html`).
 * Deliberately grayscale + `aria-hidden`: it is decoration, not content.
 */
export function ApertureGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasEl: HTMLCanvasElement = canvas
    const ctxOrNull = canvasEl.getContext('2d')
    if (!ctxOrNull) return
    /* TS does not carry the null-guard into the nested closures below, so hold an
       explicitly non-null alias and use that everywhere. */
    const ctx: CanvasRenderingContext2D = ctxOrNull


    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 256x128 land mask, row-major, MSB first, base64 (packed by mask.py). */
    const MASK_B64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/wAB/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD////////zgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//////////AAAP4AH4AAAA/AAAAAAAAAAAAAAAAADP//////////AAAf/wAEAAAAB/wAAAAAAAAAAAAAAAHef/////////4AAAf8AAAAAAAAPwAAAAAAAAAAAAAAD/ef//h//////gAAAYAAAAH4AAO/+AAHgAAAAAAAAAAE/5//8AA////+AAAAAAAAH8AAf//8AAf/AAAAAAAAAB/53//4AA////4AAAAAAAA8AAf///+eAeAAAAAAAAAAP//f//8AD///+AAAAAAAAPAPf/////8j/gAADAD/wADP/+fP//AP///4AAAAB+AA+B///////////AAYAf////////v/+Af///gAAAB//AAD//////////////wH/////////+f8A///gAAAA///v////////////////8H/////////5/+H//AawAAH///////////////////////////////P/gP/4D/gAA////////////////////H////////////+A/8AH8AAP///////////////////8DP////////x//wA/AAAAAH/v//////////////////wB////////4Af4AD8AAAAAf+f/////////////////4AP/+//////gAfmAAwAAAAB/9///////////////+fkAAD/AD/////gD/8AAAAAAeDfj//////////////BnwAAADsAB/////wH/4AAAAAB4H8//////////////gA/gAAB8AAD/////8//4AAAAAPgf7/////////////8AD8AAAOAAAf/////3//4AAAAB/D///////////////9APgAAAAAABv/////v//gAAAAH/f///////////////8A8AAAAAAAA////////+AAAAAz/////////////////4BgAAAAAAAD////////cAAAAAf////////////////9gAAAAAAAAAD////////4AAAAA/////////////////+AAAAAAAAAAH////////gAAAAB////////////////+4AAAAAAAAAAf///////AAAAAAB////////////////7gAAAAAAAAAB///////wAAAAACH///n///////////+PAAAAAAAAAAH//////EAAAAAAf/vf8A///////////x8AAAAAAAAAAf/////+AAAAAAB/5v/////////////4HAAAAAAAAAAB//////AAAAAAAH+GP/////////////AYAAAAAAAAAAD/////4AAAAAAAf4b7///////////68BgAAAAAAAAAAP/////gAAAAAAB/f/Hf///////////4eAAAAAAAAAAAf////+AAAAAAAB//AeX//////////Hv4AAAAAAAAAAA/////wAAAAAAAH/8AY//////////8d/AAAAAAAAAAAB////8AAAAAAAB//8OA//////////4PgAAAAAAAAAAAD////gAAAAAAAH//8////////////gwAAAAAAAAAAAAH///+AAAAAAAAf//////////////+AAAAAAAAAAAAAAP/+YYAAAAAAAH//////+////////4AAAAAAAAAAAAAA//gB4AAAAAAA////////////////AAAAAAAAAAAAAAB/+AHwAAAAAAH///////7///////8AAAAAAAAAAAAAAD/4AKAAAAAAAf///////+d//////4AAAAAAAAAAAAAAH/gD4AAAAAAD//////f/+D/////9gAAAAAAAAOAAAAAD+D/wAAAAAAf////////4H/////EAAAAAAAAAMAAAAAP8eD8AAAAAB//////7//AP/x/9gAAAAAAAAAAQAAAAAf/wN/AAAAAD//////n/8Af+D/2BgAAAAAAAAAAAAAAAf/A38AAAAAP//////f/gB/wH/QHAAAAAAAAAAAAAAAAf/gAAAAAAA//////8/4AD+A/+AYAAAAAAAAAAAAAAAAD+AAAAAAAH///////+AAPgAf8BwAAAAAAAAAAAAAAAAH4AAAAAAAP///////gAAfAB/wHgAAAAAAAAAAAAAAAADgfAAAAAA///////zgAB4AH/AvAAAAAAAAAAAAAAAAAOD/4AAAAB///////+AADgAJ8D8AAAAAAAAAAAAAAAAAf//wAAAAD///////wAAPABzAZwAAAAAAAAAAAAAAAAAf//gAAAAP///////AAAeAHABPAAAAAAAAAAAAAAAAAAP//wAAAAf//////8AAA4AOAOsAAAAAAAAAAAAAAAAAA///wAAAA/x/////gAAAAHcB4QAAAAAAAAAAAAAAAAAD///AAAAAAA////8AAAAAPwfAAAAAAAAAAAAAAAAAAAf//+AAAAAAD////gAAAAAfn8PAAAAAAAAAAAAAAAAAB///4AAAAAAP///8AAAAAA+f/sAAAAAAAAAAAAAAAAAP///4AAAAAA////AAAAAAB5/8/AAAAAAAAAAAAAAAAA////8AAAAAD///8AAAAAAHz7xf4EAAAAAAAAAAAAAAD////+AAAAAH///gAAAAAAPPvf/4YAAAAAAAAAAAAAAP////+AAAAAP//+AAAAAAA8A8B/34AAAAAAAAAAAAAA/////8AAAAA///4AAAAAAA/hQE/8wAAAAAAAAAAAAAB/////wAAAAB///gAAAAAAB/9YH/B4AAAAAAAAAAAAAD/////AAAAAH//+AAAAAAAAF/gDOBgAAAAAAAAAAAAAP////wAAAAAf//4AAAAAAAABYIEcDAAAAAAAAAAAAAAf////AAAAAB///gwAAAAAAAAD8wAAAAAAAAAAAAAAAB////4AAAAAP//+DAAAAAAAAAvzgAAAAAAAAAAAAAAAH////gAAAAA///4cAAAAAAAAP+PAAIAgAAAAAAAAAAAH///+AAAAAD///nwAAAAAAAB/+8AAwEAAAAAAAAAAAAH///4AAAAAP//8fAAAAAAAAP//wAAAwAAAAAAAAAAAAf///AAAAAA///B4AAAAAAAB///gAACAAAAAAAAAAAAA///8AAAAAB//4HgAAAAAAA////ADAAAAAAAAAAAAAAD///gAAAAAH//w+AAAAAAAP////AGAAAAAAAAAAAAAAf//+AAAAAAP//DwAAAAAAA////8AAAAAAAAAAAAAAAB//+AAAAAAA//8HAAAAAAAD////4AAAAAAAAAAAAAAAH//wAAAAAAD//AYAAAAAAAP////gAAAAAAAAAAAAAAAf//AAAAAAAP/8AAAAAAAAAf////AAAAAAAAAAAAAAAB//8AAAAAAAf/wAAAAAAAAB////8AAAAAAAAAAAAAAAH//AAAAAAAA/8AAAAAAAAAH////gAAAAAAAAAAAAAAAf/8AAAAAAAD/wAAAAAAAAAP///+AAAAAAAAAAAAAAAB//gAAAAAAAP+AAAAAAAAAB/gf/4AAAAAAAAAAAAAAAP/+AAAAAAAA/gAAAAAAAAAH8A//AAMAAAAAAAAAAAAA//AAAAAAAAAAAAAAAAAAAAAAB/8AAYAAAAAAAAAAAAH/8AAAAAAAAAAAAAAAAAAAAAAB/gAB4AAAAAAAAAAAAf/gAAAAAAAAAAAAAAAAAAAAAAD4AAHgAAAAAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAACAAA8AAAAAAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAPAADwAAAAAAAAAAAAf4AAAAAAAAAAAAAAAAAAAAAAAAcAA8AAAAAAAAAAAAB/AAAAAAAAAAAAAAAAAAAAAAAAAgAHwAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAD/AAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAPwAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAA/DgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAB4AAAABgwACAAAAAAAAAAAAAAAAAAfAAAAAAAAAAAAA/5AA///////8AAAAAAAAAAAAAAAADwAAAAAAAAAABh///gf////////4AAAAAAAAAAAAAAA/wAAAAAAAG/w/////P/////////+AAAAAAAAAAAQAAP/gAAAAA/////////////////////8AAAAAAAAAD8OA/+AAAAAf/////////////////////wAAAAAP//4P////4AAAAD/////////////////////+AAAAB/////////+AAAAD//////////////////////AAAAef/////////AAAAP//////////////////////4AAAf//////////AAD4P///////////////////////4AAA5/////////wAwfw////////////////////////gAAAP///////////H+f///////////////////////gAAAAP/////////////////////////////////////wAr4A//////////////////////////////////////+T//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w==';
    const MW = 256, MH = 128;
    const bin = atob(MASK_B64);
    const maskBytes = new Uint8Array(bin.length);
    for (let bi = 0; bi < bin.length; bi++) maskBytes[bi] = bin.charCodeAt(bi);
    function isLand(x: number, y: number) {
      const idx = y * MW + x;
      return (maskBytes[idx >> 3] >> (7 - (idx & 7))) & 1;
    }

    /* Fibonacci sphere sampling — identical to build.py, so the field matches
       the approved option-3 mockup. Store unit vectors; spin is applied later. */
    const N = 9000, GA = Math.PI * (3 - Math.sqrt(5));
    const vx: number[] = [], vy: number[] = [], vz: number[] = [];
    for (let k = 0; k < N; k++) {
      const sy = 1 - (k + 0.5) * 2 / N;
      const sr = Math.sqrt(Math.max(0, 1 - sy * sy));
      const th = GA * k;
      const px0 = sr * Math.cos(th), pz0 = sr * Math.sin(th);
      const lat = Math.asin(Math.max(-1, Math.min(1, sy))) * 180 / Math.PI;
      const lon = Math.atan2(pz0, px0) * 180 / Math.PI;
      const gx = Math.min(Math.max(Math.floor((lon + 180) / 360 * MW), 0), MW - 1);
      const gy = Math.min(Math.max(Math.floor((90 - lat) / 180 * MH), 0), MH - 1);
      if (!isLand(gx, gy)) continue;
      const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
      vx.push(Math.cos(la) * Math.cos(lo));
      vy.push(Math.sin(la));
      vz.push(Math.cos(la) * Math.sin(lo));
    }
    const COUNT = vx.length;

    const HUBS = [[-122.4, 37.8], [2.35, 48.85], [139.7, 35.7], [103.8, 1.35],
                [151.2, -33.9], [-46.6, -23.5], [72.9, 19.1], [-79.4, 43.7]];
    const ARCS = [[0, 2], [0, 1], [2, 3], [1, 4], [3, 5], [0, 6], [4, 3]];  /* v19: +[4,3] Sydney<->Singapore = 7 arcs, matching the mockup */
    const hub = HUBS.map(function (h) {
      const hla = h[1] * Math.PI / 180, hlo = h[0] * Math.PI / 180;
      return [Math.cos(hla) * Math.cos(hlo), Math.sin(hla), Math.cos(hla) * Math.sin(hlo)];
    });

    const TILT = 26 * Math.PI / 180;
    const SPIN0 = -15 * Math.PI / 180;
    const PERIOD = 32000;          /* 32 s per revolution, linear — self-rotation is steady */
    let W = 384, cx = 192, cy = 192, R = 192;

    /* project a unit vector: spin about the pole, then the fixed 26deg tilt */
    function proj(v: number[], cs: number, ss: number, ct: number, st: number) {
      const x = v[0] * cs - v[2] * ss;
      const z = v[0] * ss + v[2] * cs;
      return [x, v[1] * ct - z * st, v[1] * st + z * ct];
    }

    /* colour: read from --foreground at runtime so the field follows the theme */
    function parseRGB(s: string) {
      s = (s || '').trim();
      if (s.charAt(0) === '#') {
        let h = s.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
      }
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (m) { const p = m[1].split(','); return [Number.parseInt(p[0], 10), Number.parseInt(p[1], 10), Number.parseInt(p[2], 10)]; }
      return null;
    }
    let INK = [29, 29, 31], inkCache: Record<number, string> = {};
    function readInk() {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--foreground');
      const rgb = parseRGB(raw) || parseRGB(getComputedStyle(document.body).color);
      if (rgb) INK = rgb;
      inkCache = {};
    }
    function ink(a: number) {
      const q = (a * 100) | 0;
      let s = inkCache[q];
      if (s === undefined) {
        s = `rgba(${INK[0]},${INK[1]},${INK[2]},${(q / 100).toFixed(2)})`;
        inkCache[q] = s;
      }
      return s;
    }

    function draw(spin: number) {
      LAST = spin;                        /* remember the angle — resize() repaints it */
      ctx.clearRect(0, 0, W, W);
      const cs = Math.cos(spin), ss = Math.sin(spin);
      const ct = Math.cos(TILT), st = Math.sin(TILT);
      let i, x0, y0, z0, x, z, y2, z2, a, rr;
      /* land dots — depth-shaded: front dots bigger and more opaque */
      for (i = 0; i < COUNT; i++) {
        x0 = vx[i]; y0 = vy[i]; z0 = vz[i];
        x = x0 * cs - z0 * ss;
        z = x0 * ss + z0 * cs;
        y2 = y0 * ct - z * st;
        z2 = y0 * st + z * ct;
        if (z2 <= 0.02) continue;                    /* back of the sphere */
        /* depth shade — lifted 0.10/0.62 -> 0.14/0.66 (review P1-2): on the
           light theme the rim dots at z~0.3 were ~1.86:1, below the 3:1 floor
           for readable decoration; the extra 0.04 floor + 0.04 span brings the
           rim back into range while keeping the depth gradient. */
        a = 0.14 + 0.66 * Math.pow(z2, 0.8);
        /* v19 — dot radius now scales WITH the sphere: the canvas grew 384 -> 560,
           so the old absolute 1.3px would read too sparse. 1.5 keeps the mockup's
           dot/diameter ratio while holding contrast (cap: never above 1.6, or the
           field smears into a solid surface). */
        rr = 1.5 * (0.6 + 0.4 * z2);
        ctx.fillStyle = ink(a);
        ctx.beginPath();
        ctx.arc(cx + x * R, cy - y2 * R, rr, 0, 6.2832);
        ctx.fill();
      }
      /* connection arcs — quadratic bezier bowed outward, clipped to the disc */
      for (let ai = 0; ai < ARCS.length; ai++) {
        const p1 = proj(hub[ARCS[ai][0]], cs, ss, ct, st);
        const p2 = proj(hub[ARCS[ai][1]], cs, ss, ct, st);
        if (p1[2] <= 0.02 || p2[2] <= 0.02) continue;
        const ax = cx + p1[0] * R, ay = cy - p1[1] * R;
        const bx = cx + p2[0] * R, by = cy - p2[1] * R;
        const ux2 = (ax + bx) / 2 - cx, uy2 = (ay + by) / 2 - cy;
        const L = Math.sqrt(ux2 * ux2 + uy2 * uy2) || 1;
        const kk = 1 + 0.24 * (1 - L / R);
        const qx = cx + ux2 * kk, qy = cy + uy2 * kk;
        for (let t = 0; t <= 100; t += 2) {
          const u = t / 100;
          const ix = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * qx + u * u * bx;
          const iy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * qy + u * u * by;
          if (Math.hypot(ix - cx, iy - cy) > R) continue;   /* never leave the sphere */
          ctx.fillStyle = ink(0.51 * Math.pow(Math.sin(Math.PI * u), 0.65));
          ctx.beginPath();
          ctx.arc(ix, iy, 1.1, 0, 6.2832);
          ctx.fill();
        }
      }
      /* hub nodes — a solid dot plus a faint halo ring */
      for (let hi = 0; hi < hub.length; hi++) {
        const hp = proj(hub[hi], cs, ss, ct, st);
        if (hp[2] <= 0.02) continue;
        const hx = cx + hp[0] * R, hy = cy - hp[1] * R;
        ctx.fillStyle = ink(0.43 + 0.55 * hp[2]);
        ctx.beginPath();
        ctx.arc(hx, hy, 3.4 * (0.7 + 0.3 * hp[2]), 0, 6.2832);
        ctx.fill();
        ctx.strokeStyle = ink(0.12 + 0.16 * hp[2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, 10 * (0.7 + 0.3 * hp[2]), 0, 6.2832);
        ctx.stroke();
      }
    }

    /* ★ Assigning `canvas.width` / `canvas.height` CLEARS the bitmap. Previously the
       repaint only happened inside the rAF `tick`, so any resize that arrived while the
       loop was not ticking left a BLANK sphere — which is exactly what happened when the
       page was captured full-page (Chrome's `captureBeyondViewport` resizes the viewport
       first), and it is also reachable in the wild: resize the window while the globe is
       scrolled out of view (`stop()` has cancelled the loop) and the band comes back
       empty. Repainting at the last angle inside resize() closes both holes. */
    let LAST = SPIN0;
    function resize() {
      const cssW = canvasEl.clientWidth || 384;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.round(cssW * dpr);
      canvasEl.height = Math.round(cssW * dpr);
      W = cssW; cx = cssW / 2; cy = cssW / 2; R = cssW / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(LAST);                         /* repaint immediately — never leave it blank */
    }

    let rafId: number | null = null, running = false, t0 = 0;
    function tick(ts: number) {
      if (!t0) t0 = ts;
      draw(SPIN0 + (ts - t0) / PERIOD * 2 * Math.PI);
      rafId = requestAnimationFrame(tick);
    }
    function start() { if (running || reduce) return; running = true; rafId = requestAnimationFrame(tick); }
    function stop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } t0 = 0; }

    let gio: IntersectionObserver | null = null;
    let themeObs: MutationObserver | null = null;

    readInk();                            /* must precede resize() — resize() now paints */
    resize();
    if (reduce) {
      /* nothing else to do — resize() already painted the static frame */
    } else {
      if ('IntersectionObserver' in window) {
        gio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
        }, { threshold: 0 });
        gio.observe(canvasEl);
      }
      start();
    }

    /* theme follow — re-read --foreground when the root class flips, and repaint
       unconditionally: with the loop paused (globe off-screen) a bare readInk() would
       leave the sphere painted in the previous theme's ink. */
    if (window.MutationObserver) {
      themeObs = new MutationObserver(function () {
        readInk();
        draw(LAST);
      });
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    }
    const onResize = function () { resize(); };
    window.addEventListener('resize', onResize);
    return () => {
      stop()
      if (gio) gio.disconnect()
      if (themeObs) themeObs.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden='true'
      role='presentation'
    />
  )
}
