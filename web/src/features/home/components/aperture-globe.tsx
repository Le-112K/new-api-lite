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

import { cn } from '@/lib/utils'

/**
 * ApertureGlobe — the rotating dot-field earth that anchors the Aperture hero.
 *
 * The land is real: Natural Earth 110m coastlines rasterised into a 256x128
 * 1bpp mask (base64, ~5.5 KB), sampled with a Fibonacci sphere distribution so
 * point density stays uniform on the sphere instead of piling up at the poles.
 * The mask is the resolution limit for the coastline, so legibility comes from
 * sampling it densely (N) rather than from regenerating the mask.
 *
 * Rendering had to get cheaper before it could get denser: every land dot used
 * to be its own beginPath/arc/fill. Dots are now bucketed by quantised depth
 * into `BANDS` Path2D objects and filled in a single pass per bucket, so the
 * per-frame cost is dominated by path building, not by fill calls.
 *
 * What makes it read as a sphere rather than a speckled disc: a very faint
 * per-30° graticule under the land, a depth ramp that drives both radius and
 * opacity, and a subtle limb gradient that deepens toward the edge. Orthographic
 * projection, fixed 26° tilt, one revolution per 32 s when left alone.
 *
 * Each route carries a travelling pulse that sweeps A -> B and then rests; the
 * seven periods/offsets are deliberately incommensurate so they never fire in
 * unison. The pulse head is the brightest element on the canvas by construction
 * (fully opaque, larger radius) — keep it that way, the visual verification
 * probe locates pulses by that saturation.
 *
 * Everything is drawn in `--foreground`, re-read whenever the theme flips, so
 * the field follows light/dark without any colour literal in this file.
 * Vertical panning is left to the browser (`touch-action: pan-y`) so the hero
 * can still be scrolled past on touch; horizontal drag spins the sphere with
 * momentum that decays back into the automatic drift.
 *
 * Grows out of the approved prototype (`deliverables/aperture-landing.html`),
 * deliberately grayscale + `aria-hidden`: it is decoration, not content.
 */
export function ApertureGlobe(props: { className?: string }) {
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
       the approved option-3 mockup. Store unit vectors; spin is applied later.
       N is deliberately large: the mask cell size is fixed, so only density
       turns the coastline from a blobby stipple into a legible edge. */
    const N = 26000, GA = Math.PI * (3 - Math.sqrt(5));
    /* Deterministic hash -> [0,1), so the stipple is identical on every repaint
       (including the single static frame under reduced motion). */
    function hash(k: number, salt: number) {
      const x = Math.sin(k * 127.1 + salt * 311.7) * 43758.5453;
      return x - Math.floor(x);
    }
    /* A pure Fibonacci lattice is even but not random, and at this density its
       own structure shows as spiral arms with concentric rings near the poles.
       Jittering the drawn position by ~half a sample breaks that moiré. The land
       test below still uses the exact sample position, so a dot can never jump
       off the coast — only where it is painted moves, well inside one 1.4° cell. */
    const JITTER = 0.016;
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
      let ux = Math.cos(la) * Math.cos(lo);
      let uy = Math.sin(la);
      let uz = Math.cos(la) * Math.sin(lo);
      ux += (hash(k, 1) - 0.5) * JITTER;
      uy += (hash(k, 2) - 0.5) * JITTER;
      uz += (hash(k, 3) - 0.5) * JITTER;
      const inv = 1 / Math.sqrt(ux * ux + uy * uy + uz * uz);
      vx.push(ux * inv);
      vy.push(uy * inv);
      vz.push(uz * inv);
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
    const AUTO_PERIOD = 32000;                  /* 32 s per revolution when left alone */
    const AUTO_OMEGA = 2 * Math.PI / AUTO_PERIOD;  /* rad per ms */
    const TAU = Math.PI * 2;
    const INERTIA_TAU = 130;                    /* ms — drag momentum decay constant */
    const DRAG_GAIN = 1.15;                     /* full-diameter drag ~ 207° */

    /* Depth handling. Z_CULL drops the extreme foreshortened rim, where uniform
       sphere sampling piles dots up into an opaque smear; `d` is what is left,
       normalised to [0,1], and it drives radius AND opacity so the field reads
       front-to-back instead of as a flat speckle. */
    const Z_CULL = 0.10;
    const INV_ZSPAN = 1 / (1 - Z_CULL);
    const BANDS = 16;                           /* depth buckets -> 16 Path2D fills per frame */
    /* Contrast floor: the faintest *rendered* land dot has to clear 3:1 against
       the page in BOTH themes. Light theme (#F5F5F7 bg, #0a0a0a ink) is the
       binding case — 3:1 needs a composited luminance low enough that the peak
       pixel alpha must stay >= ~0.44. A_MIN is the nominal floor and the radius
       floor is kept at ~1px so antialiasing (and a dot landing on a pixel
       corner, the worst case: ~0.79 of nominal) cannot eat that coverage.
       Do not lower either without re-measuring; the verify probe checks it. */
    const A_MIN = 0.72, A_SPAN = 0.20;
    const R_BASE = 1.12;
    const bandAlpha = new Float32Array(BANDS);
    const bandRadius = new Float32Array(BANDS);
    const bandInk: string[] = [];
    for (let k = 0; k < BANDS; k++) {
      const d = (k + 0.5) / BANDS;
      bandAlpha[k] = A_MIN + A_SPAN * Math.pow(d, 1.25);
      bandRadius[k] = R_BASE * (0.80 + 0.20 * Math.pow(d, 0.7));
    }

    /* Faint graticule — the strongest "this is a sphere" cue. Must stay strictly
       under GA_ALPHA so the field does not turn into a wireframe; it also sits
       below the land in visual weight. Kept below 0.20 on purpose: the contrast
       probe separates land dots from the graticule at alpha 0.30. */
    const DEG = Math.PI / 180;
    const GA_ALPHA = 0.12;
    const GA_WIDTH = 0.7;
    const PARALLELS = [-60, -30, 0, 30, 60];
    const MERIDIANS: number[] = [];
    for (let lo = -180; lo < 180; lo += 30) MERIDIANS.push(lo);

    /* Route pulses. SWEEP is the fraction of the period used by the sweep; the
       rest is the rest. Periods and offsets are incommensurate on purpose. */
    const ARC_BASE = 0.51;
    const PULSE_ADD = 0.90;                     /* head saturates at alpha 1.0 */
    const PULSE_W = 0.11;
    const SWEEP = 0.42;
    const ARC_PERIOD = [5200, 6084, 4316, 6812, 4732, 5668, 6396];
    const ARC_OFFSET = [0.00, 0.37, 0.71, 0.14, 0.55, 0.88, 0.26];

    let W = 384, cx = 192, cy = 192, R = 192;
    let spin = SPIN0, vel = 0;

    /* project a unit vector: spin about the pole, then the fixed 26deg tilt */
    function proj(v: number[], cs: number, ss: number, ct: number, st: number) {
      const x = v[0] * cs - v[2] * ss;
      const z = v[0] * ss + v[2] * cs;
      return [x, v[1] * ct - z * st, v[1] * st + z * ct];
    }

    /* same projection, but from a lat/lon on the sphere — used by the graticule
       so the grid is welded to the earth and spins with it. */
    function sphere(lat: number, lon: number, cs: number, ss: number, ct: number, st: number) {
      const la = lat * DEG, lo = lon * DEG;
      const cosLa = Math.cos(la);
      const x0 = cosLa * Math.cos(lo);
      const y0 = Math.sin(la);
      const z0 = cosLa * Math.sin(lo);
      const x = x0 * cs - z0 * ss;
      const z = x0 * ss + z0 * cs;
      return [x, y0 * ct - z * st, y0 * st + z * ct];
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
      /* the band fills are colour strings too — they must be rebuilt with the ink */
      for (let k = 0; k < BANDS; k++) bandInk[k] = ink(bandAlpha[k]);
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

    /* Lat/long grid, front hemisphere only, welded to the earth so it rotates
       with it. Orthographic projection of a unit sphere lands inside the disc by
       construction, so no clipping is needed — only the back-face cull. */
    function drawGraticule(cs: number, ss: number, ct: number, st: number) {
      const path = new Path2D();
      let pen = false, sx = 0, sy = 0;
      let pt: number[] = [0, 0, 0];
      for (let pi = 0; pi < PARALLELS.length; pi++) {
        pen = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          pt = sphere(PARALLELS[pi], lon, cs, ss, ct, st);
          if (pt[2] <= Z_CULL) { pen = false; continue; }
          sx = cx + pt[0] * R; sy = cy - pt[1] * R;
          if (pen) path.lineTo(sx, sy); else { path.moveTo(sx, sy); pen = true; }
        }
      }
      for (let mi = 0; mi < MERIDIANS.length; mi++) {
        pen = false;
        for (let lat = -88; lat <= 88; lat += 4) {
          pt = sphere(lat, MERIDIANS[mi], cs, ss, ct, st);
          if (pt[2] <= Z_CULL) { pen = false; continue; }
          sx = cx + pt[0] * R; sy = cy - pt[1] * R;
          if (pen) path.lineTo(sx, sy); else { path.moveTo(sx, sy); pen = true; }
        }
      }
      ctx.strokeStyle = ink(GA_ALPHA);
      ctx.lineWidth = GA_WIDTH;
      ctx.stroke(path);
    }

    /* The land. One Path2D per depth band, then BANDS fills — this is what buys
       the extra density. Each dot needs its own moveTo: Path2D.arc() draws a
       connecting line from the current point otherwise, which turns the field
       into a spiderweb. Bands are filled back-to-front. */
    function drawLand(cs: number, ss: number, ct: number, st: number) {
      const paths: Path2D[] = [];
      for (let k = 0; k < BANDS; k++) paths.push(new Path2D());
      for (let i = 0; i < COUNT; i++) {
        const x0 = vx[i], y0 = vy[i], z0 = vz[i];
        const x = x0 * cs - z0 * ss;
        const z = x0 * ss + z0 * cs;
        const y2 = y0 * ct - z * st;
        const z2 = y0 * st + z * ct;
        if (z2 <= Z_CULL) continue;                  /* back of the sphere */
        let k = ((z2 - Z_CULL) * INV_ZSPAN * BANDS) | 0;
        if (k >= BANDS) k = BANDS - 1;
        const sx = cx + x * R, sy = cy - y2 * R, rr = bandRadius[k];
        const p = paths[k];
        p.moveTo(sx + rr, sy);
        p.arc(sx, sy, rr, 0, TAU);
      }
      for (let k = 0; k < BANDS; k++) {
        ctx.fillStyle = bandInk[k];
        ctx.fill(paths[k]);
      }
    }

    /* Limb: a near-monochrome dot field has no shading of its own, so the disc
       reads as flat-cut. This breathes a whisper of ink into a band just inside
       the edge and lets it fall away again at the very rim, so the silhouette
       curves off instead of stopping. Additive ink only — never a fade, which
       would push the faintest dots back under the 3:1 floor — and deliberately
       narrow: a wide gradient reads as a grey glass disc over the ocean, not as
       shading on the sphere. */
    function drawLimb() {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, ink(0));
      g.addColorStop(0.8, ink(0));
      g.addColorStop(0.93, ink(0.045));
      g.addColorStop(1, ink(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
    }

    /* Routes: the dotted base curve keeps the line readable when nothing is on
       it; the pulse is a saturated head that runs A -> B for the first SWEEP of
       the period, then rests. `env` ramps the head in and out so it does not pop. */
    function drawArcs(cs: number, ss: number, ct: number, st: number, tMs: number) {
      for (let ai = 0; ai < ARCS.length; ai++) {
        const p1 = proj(hub[ARCS[ai][0]], cs, ss, ct, st);
        const p2 = proj(hub[ARCS[ai][1]], cs, ss, ct, st);
        if (p1[2] <= Z_CULL || p2[2] <= Z_CULL) continue;
        const ax = cx + p1[0] * R, ay = cy - p1[1] * R;
        const bx = cx + p2[0] * R, by = cy - p2[1] * R;
        const ux2 = (ax + bx) / 2 - cx, uy2 = (ay + by) / 2 - cy;
        const L = Math.sqrt(ux2 * ux2 + uy2 * uy2) || 1;
        const kk = 1 + 0.24 * (1 - L / R);
        const qx = cx + ux2 * kk, qy = cy + uy2 * kk;
        let uP = -1, env = 0;
        if (!reduce) {
          const ph = ((tMs / ARC_PERIOD[ai]) + ARC_OFFSET[ai]) % 1;
          if (ph < SWEEP) {
            uP = ph / SWEEP;
            env = Math.min(1, 5 * Math.sin(Math.PI * uP));
          }
        }
        for (let t = 0; t <= 100; t += 2) {
          const u = t / 100;
          const ix = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * qx + u * u * bx;
          const iy = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * qy + u * u * by;
          if (Math.hypot(ix - cx, iy - cy) > R) continue;   /* never leave the sphere */
          const base = ARC_BASE * Math.pow(Math.sin(Math.PI * u), 0.65);
          let a = base, rr = 1.1;
          if (uP >= 0) {
            const step = (u - uP) / PULSE_W;
            const bump = env * Math.exp(-step * step);
            if (bump > 0.002) {
              a = Math.min(1, base + PULSE_ADD * bump);
              /* the head has to be fat enough that consecutive samples overlap —
                 at the base radius they stay separate specks and the "signal"
                 never reads as a moving segment. */
              rr = 1.1 + 2.2 * bump;
            }
          }
          ctx.fillStyle = ink(a);
          ctx.beginPath();
          ctx.arc(ix, iy, rr, 0, TAU);
          ctx.fill();
        }
      }
    }

    /* Hub nodes — a solid dot plus a faint halo ring. Kept below 0.95 so the
       pulse head stays the only saturated ink on the canvas. */
    function drawHubs(cs: number, ss: number, ct: number, st: number) {
      for (let hi = 0; hi < hub.length; hi++) {
        const hp = proj(hub[hi], cs, ss, ct, st);
        if (hp[2] <= Z_CULL) continue;
        const hx = cx + hp[0] * R, hy = cy - hp[1] * R;
        ctx.fillStyle = ink(0.40 + 0.50 * hp[2]);
        ctx.beginPath();
        ctx.arc(hx, hy, 3.4 * (0.7 + 0.3 * hp[2]), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = ink(0.10 + 0.14 * hp[2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(hx, hy, 10 * (0.7 + 0.3 * hp[2]), 0, TAU);
        ctx.stroke();
      }
    }

    function draw(angle: number, tMs: number) {
      LAST = angle;                       /* remember the angle — resize() repaints it */
      spin = angle;
      ctx.clearRect(0, 0, W, W);
      const cs = Math.cos(angle), ss = Math.sin(angle);
      const ct = Math.cos(TILT), st = Math.sin(TILT);
      drawGraticule(cs, ss, ct, st);       /* sphere cue, under the land in weight */
      drawLand(cs, ss, ct, st);
      drawLimb();
      drawArcs(cs, ss, ct, st, tMs);
      drawHubs(cs, ss, ct, st);
    }

    /* ★ Assigning `canvas.width` / `canvas.height` CLEARS the bitmap. Previously the
       repaint only happened inside the rAF `tick`, so any resize that arrived while the
       loop was not ticking left a BLANK sphere — which is exactly what happened when the
       page was captured full-page (Chrome's `captureBeyondViewport` resizes the viewport
       first), and it is also reachable in the wild: resize the window while the globe is
       scrolled out of view (`stop()` has cancelled the loop) and the band comes back
       empty. Repainting at the last angle inside resize() closes both holes. */
    let LAST = SPIN0;
    let dragging = false, pointerId: number | null = null, lastX = 0, lastMoveT = 0;
    function nowMs() { return window.performance ? window.performance.now() : Date.now(); }
    function resize() {
      const cssW = canvasEl.clientWidth || 384;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.round(cssW * dpr);
      canvasEl.height = Math.round(cssW * dpr);
      W = cssW; cx = cssW / 2; cy = cssW / 2; R = cssW / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(LAST, nowMs());                /* repaint immediately — never leave it blank */
    }

    /* One accumulated angle drives everything. While dragging the pointer owns
       it; after release momentum decays exponentially until it falls to the auto
       drift speed and the steady rotation simply takes over — no seam, no snap.
       dt is clamped so a long off-screen pause cannot teleport the ball. */
    let rafId: number | null = null, running = false, lastTs = 0;
    function tick(ts: number) {
      const dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
      lastTs = ts;
      if (!dragging) {
        if (Math.abs(vel) > AUTO_OMEGA) {
          spin += vel * dt;
          vel *= Math.exp(-dt / INERTIA_TAU);
        } else {
          vel = 0;
          spin += AUTO_OMEGA * dt;
        }
      }
      draw(spin, ts);
      rafId = requestAnimationFrame(tick);
    }
    function start() { if (running || reduce) return; running = true; lastTs = 0; rafId = requestAnimationFrame(tick); }
    function stop() { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } lastTs = 0; }

    /* Drag to spin. Pointer events so mouse, pen and touch all work. The canvas
       only captures the pointer while a drag is actually in flight, and its
       touch-action is `pan-y` (see the className) so a vertical swipe still
       scrolls the page — the browser then fires pointercancel and we let go. */
    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastMoveT = nowMs();
      vel = 0;
      canvasEl.dataset.dragging = 'true';
      if (canvasEl.setPointerCapture) {
        try { canvasEl.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging || e.pointerId !== pointerId) return;
      const t = nowMs();
      const dt = Math.max(1, t - lastMoveT);
      const dSpin = -(e.clientX - lastX) * (Math.PI / (2 * R)) * DRAG_GAIN;
      spin += dSpin;
      vel = vel * 0.6 + (dSpin / dt) * 0.4;
      lastX = e.clientX;
      lastMoveT = t;
      if (reduce) draw(spin, 0);          /* no loop to paint for us */
    }
    function endDrag(e: PointerEvent) {
      if (!dragging || (e.pointerId !== undefined && e.pointerId !== pointerId)) return;
      dragging = false;
      delete canvasEl.dataset.dragging;
      if (pointerId !== null && canvasEl.releasePointerCapture) {
        try { canvasEl.releasePointerCapture(pointerId); } catch { /* already gone */ }
      }
      pointerId = null;
      if (reduce) vel = 0;                /* nothing may keep moving on its own */
    }

    let gio: IntersectionObserver | null = null;
    let themeObs: MutationObserver | null = null;

    readInk();                            /* must precede resize() — resize() now paints */
    resize();
    if (reduce) {
      /* nothing else to do — resize() already painted the static frame. A drag
         still repaints from onPointerMove, but nothing animates on its own. */
    } else {
      if ('IntersectionObserver' in window) {
        gio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
        }, { threshold: 0 });
        gio.observe(canvasEl);
      }
      start();
    }
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', endDrag);
    canvasEl.addEventListener('pointercancel', endDrag);
    canvasEl.addEventListener('lostpointercapture', endDrag);

    /* theme follow — re-read --foreground when the root class flips, and repaint
       unconditionally: with the loop paused (globe off-screen) a bare readInk() would
       leave the sphere painted in the previous theme's ink. */
    if (window.MutationObserver) {
      themeObs = new MutationObserver(function () {
        readInk();
        draw(LAST, nowMs());
      });
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    }
    const onResize = function () { resize(); };
    window.addEventListener('resize', onResize);
    return () => {
      stop()
      if (gio) gio.disconnect()
      if (themeObs) themeObs.disconnect()
      canvasEl.removeEventListener('pointerdown', onPointerDown)
      canvasEl.removeEventListener('pointermove', onPointerMove)
      canvasEl.removeEventListener('pointerup', endDrag)
      canvasEl.removeEventListener('pointercancel', endDrag)
      canvasEl.removeEventListener('lostpointercapture', endDrag)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'touch-pan-y cursor-grab active:cursor-grabbing data-[dragging=true]:cursor-grabbing',
        props.className,
      )}
      aria-hidden='true'
      role='presentation'
    />
  )
}
