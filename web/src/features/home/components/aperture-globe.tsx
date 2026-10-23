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
 * 1bpp mask (base64, ~5.5 KB). Everything else is generated at mount and then
 * only projected, so the per-frame cost is path building, not maths.
 *
 * ---------------------------------------------------------------------------
 * v2 — what was changed, and why
 * ---------------------------------------------------------------------------
 * 1. Subdivision. The sample set used to be a Fibonacci lattice. Its global
 *    regularity is what produced the spiral arms and the concentric rings near
 *    the poles visible in the first cut: at 27k points the lattice's own
 *    structure becomes the loudest thing on the canvas. It is now equal-area
 *    latitude bands — points per band proportional to that band's
 *    circumference — with a random phase per band and a sub-cell jitter inside
 *    it. The band count is solved so the cells come out square, otherwise the
 *    anisotropy alone lays the stipple out in latitude rows.
 * 2. Coastline. The mask is a 1.4°/cell bitmap, so sampling it per cell leaves
 *    a staircase. It is now sampled as a bilinear coverage field, which puts the
 *    land/ocean edge at half-cell precision, and any sample within half a cell
 *    of that edge is promoted to a heavier "coast tier". That tier is what gives
 *    continents a readable engraved rim without drawing a line.
 * 3. Depth. Dot radius now follows the cosine of the surface normal's depth
 *    component, so the foreshortened rim shrinks instead of piling up into an
 *    opaque smear, and the outermost ring is dissolved per dot rather than cut.
 * 4. Light. A fixed view-space light at the upper left drives per-dot ink. A
 *    monochrome dot field has no shading of its own — the first cut read as a
 *    speckled disc — so the lit hemisphere now carries more ink and the far side
 *    less. The terminator is drawn by the dots themselves; no grey gradient is
 *    laid over the field.
 * 5. Routes. Screen-space quadratic beziers became great-circle (slerp) paths,
 *    which stay welded to the sphere and foreshorten correctly at the limb, and
 *    are dotted by *screen* distance so they never collapse into a solid line.
 *
 * Deliberately kept: orthographic projection, the square footprint, monochrome
 * `--foreground` ink (re-read on theme flip), the faint graticule, one
 * revolution per 32 s, drag-to-spin with momentum, and the single static frame
 * under `prefers-reduced-motion`.
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

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /* ======================================================================
       Tuning. Every number that shapes the field lives here — the rest of the
       file only reads them, so the look can be re-tuned without touching maths.
       ====================================================================== */
    const SAMPLE_COUNT = 36000 // sphere samples before the land test; density is the only lever on coastline legibility
    const FIT = 0.955 // sphere radius as a fraction of the canvas half-width (leaves room for the halo)
    const TILT = (23.4 * Math.PI) / 180 // real axial tilt — the polar cap reads as a cap, not a squashed oval
    const Z_MIN = 0.035 // back-face cull; too small and the rim smears, too large and the edge looks cut
    const R_BASE = 0.98 // dot radius at the centre of the disc, css px
    const R_LIMB = 0.46 // dot radius at the limb, as a fraction of R_BASE (cosine foreshortening)
    const A_LIT = 0.90 // ink alpha where the light hits square-on
    const A_DARK = 0.56 // ink alpha on the far side — the floor that keeps the field from fogging out
    const SHADE_BANDS = 16 // quantised alpha steps; one Path2D fill per step
    const LIGHT = [-0.46, 0.58, 0.67] // view-space light: x right, y up, z toward the viewer
    const COAST_STEP = 2 // coast samples are promoted this many shade steps (a darker rim)
    const COAST_SIZE = 1.1 // ...and this much larger
    const GRID_ALPHA = 0.18 // graticule ink on the lit side; the gradient takes it to 0.02 opposite
    const GRID_WIDTH = 0.7
    const ARC_BASE = 0.22 // resting route ink; the pulse still saturates
    const ARC_SAMPLES = 96 // samples per great circle (precomputed once)
    const ARC_GAP = 3.4 // screen-space spacing between route dots, css px
    const ARC_LIFT = 1.012 // arcs sit a hair above the surface so they never z-fight the cull
    const SWEEP = 0.42 // fraction of each period the pulse spends travelling
    const AUTO_PERIOD = 32000 // ms per revolution when left alone
    const SPIN0 = (-15 * Math.PI) / 180
    const INERTIA_TAU = 130 // ms — drag momentum decay constant
    const DRAG_GAIN = 1.15 // full-diameter drag ≈ 207°

    const TAU = Math.PI * 2
    const DEG = Math.PI / 180

    /* ======================================================================
       Land mask. 256x128, row-major, MSB first, base64 (packed by mask.py).
       ====================================================================== */
    const MASK_B64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/wAB/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD////////zgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//////////AAAP4AH4AAAA/AAAAAAAAAAAAAAAAADP//////////AAAf/wAEAAAAB/wAAAAAAAAAAAAAAAHef/////////4AAAf8AAAAAAAAPwAAAAAAAAAAAAAAD/ef//h//////gAAAYAAAAH4AAO/+AAHgAAAAAAAAAAE/5//8AA////+AAAAAAAAH8AAf//8AAf/AAAAAAAAAB/53//4AA////4AAAAAAAA8AAf///+eAeAAAAAAAAAAP//f//8AD///+AAAAAAAAPAPf/////8j/gAADAD/wADP/+fP//AP///4AAAAB+AA+B///////////AAYAf////////v/+Af///gAAAB//AAD//////////////wH/////////+f8A///gAAAA///v////////////////8H/////////5/+H//AawAAH///////////////////////////////P/gP/4D/gAA////////////////////H////////////+A/8AH8AAP///////////////////8DP////////x//wA/AAAAAH/v//////////////////wB////////4Af4AD8AAAAAf+f/////////////////4AP/+//////gAfmAAwAAAAB/9///////////////+fkAAD/AD/////gD/8AAAAAAeDfj//////////////BnwAAADsAB/////wH/4AAAAAB4H8//////////////gA/gAAB8AAD/////8//4AAAAAPgf7/////////////8AD8AAAOAAAf/////3//4AAAAB/D///////////////9APgAAAAAABv/////v//gAAAAH/f///////////////8A8AAAAAAAA////////+AAAAAz/////////////////4BgAAAAAAAD////////cAAAAAf////////////////9gAAAAAAAAAD////////4AAAAA/////////////////+AAAAAAAAAAH////////gAAAAB////////////////+4AAAAAAAAAAf///////AAAAAAB////////////////7gAAAAAAAAAB///////wAAAAACH///n///////////+PAAAAAAAAAAH//////EAAAAAAf/vf8A///////////x8AAAAAAAAAAf/////+AAAAAAB/5v/////////////4HAAAAAAAAAAB//////AAAAAAAH+GP/////////////AYAAAAAAAAAAD/////4AAAAAAAf4b7///////////68BgAAAAAAAAAAP/////gAAAAAAB/f/Hf///////////4eAAAAAAAAAAAf////+AAAAAAAB//AeX//////////Hv4AAAAAAAAAAA/////wAAAAAAAH/8AY//////////8d/AAAAAAAAAAAB////8AAAAAAAB//8OA//////////4PgAAAAAAAAAAAD////gAAAAAAAH//8////////////gwAAAAAAAAAAAAH///+AAAAAAAAf//////////////+AAAAAAAAAAAAAAP/+YYAAAAAAAH//////+////////4AAAAAAAAAAAAAA//gB4AAAAAAA////////////////AAAAAAAAAAAAAAB/+AHwAAAAAAH///////7///////8AAAAAAAAAAAAAAD/4AKAAAAAAAf///////+d//////4AAAAAAAAAAAAAAH/gD4AAAAAAD//////f/+D/////9gAAAAAAAAOAAAAAD+D/wAAAAAAf////////4H/////EAAAAAAAAAMAAAAAP8eD8AAAAAB//////7//AP/x/9gAAAAAAAAAAQAAAAAf/wN/AAAAAD//////n/8Af+D/2BgAAAAAAAAAAAAAAAf/A38AAAAAP//////f/gB/wH/QHAAAAAAAAAAAAAAAAf/gAAAAAAA//////8/4AD+A/+AYAAAAAAAAAAAAAAAAD+AAAAAAAH///////+AAPgAf8BwAAAAAAAAAAAAAAAAH4AAAAAAAP///////gAAfAB/wHgAAAAAAAAAAAAAAAADgfAAAAAA///////zgAB4AH/AvAAAAAAAAAAAAAAAAAOD/4AAAAB///////+AADgAJ8D8AAAAAAAAAAAAAAAAAf//wAAAAD///////wAAPABzAZwAAAAAAAAAAAAAAAAAf//gAAAAP///////AAAeAHABPAAAAAAAAAAAAAAAAAAP//wAAAAf//////8AAA4AOAOsAAAAAAAAAAAAAAAAAA///wAAAA/x/////gAAAAHcB4QAAAAAAAAAAAAAAAAAD///AAAAAAA////8AAAAAPwfAAAAAAAAAAAAAAAAAAAf//+AAAAAAD////gAAAAAfn8PAAAAAAAAAAAAAAAAAB///4AAAAAAP///8AAAAAA+f/sAAAAAAAAAAAAAAAAAP///4AAAAAA////AAAAAAB5/8/AAAAAAAAAAAAAAAAA////8AAAAAD///8AAAAAAHz7xf4EAAAAAAAAAAAAAAD////+AAAAAH///gAAAAAAPPvf/4YAAAAAAAAAAAAAAP////+AAAAAP//+AAAAAAA8A8B/34AAAAAAAAAAAAAA/////8AAAAA///4AAAAAAA/hQE/8wAAAAAAAAAAAAAB/////wAAAAB///gAAAAAAB/9YH/B4AAAAAAAAAAAAAD/////AAAAAH//+AAAAAAAAF/gDOBgAAAAAAAAAAAAAP////wAAAAAf//4AAAAAAAABYIEcDAAAAAAAAAAAAAAf////AAAAAB///gwAAAAAAAAD8wAAAAAAAAAAAAAAAB////4AAAAAP//+DAAAAAAAAAvzgAAAAAAAAAAAAAAAH////gAAAAA///4cAAAAAAAAP+PAAIAgAAAAAAAAAAAH///+AAAAAD///nwAAAAAAAB/+8AAwEAAAAAAAAAAAAH///4AAAAAP//8fAAAAAAAAP//wAAAwAAAAAAAAAAAAf///AAAAAA///B4AAAAAAAB///gAACAAAAAAAAAAAAA///8AAAAAB//4HgAAAAAAA////ADAAAAAAAAAAAAAAD///gAAAAAH//w+AAAAAAAP////AGAAAAAAAAAAAAAAf//+AAAAAAP//DwAAAAAAA////8AAAAAAAAAAAAAAAB//+AAAAAAA//8HAAAAAAAD////4AAAAAAAAAAAAAAAH//wAAAAAAD//AYAAAAAAAP////gAAAAAAAAAAAAAAAf//AAAAAAAP/8AAAAAAAAAf////AAAAAAAAAAAAAAAB//8AAAAAAAf/wAAAAAAAAB////8AAAAAAAAAAAAAAAH//AAAAAAAA/8AAAAAAAAAH////gAAAAAAAAAAAAAAAf/8AAAAAAAD/wAAAAAAAAAP///+AAAAAAAAAAAAAAAB//gAAAAAAAP+AAAAAAAAAB/gf/4AAAAAAAAAAAAAAAP/+AAAAAAAA/gAAAAAAAAAH8A//AAMAAAAAAAAAAAAA//AAAAAAAAAAAAAAAAAAAAAAB/8AAYAAAAAAAAAAAAH/8AAAAAAAAAAAAAAAAAAAAAAB/gAB4AAAAAAAAAAAAf/gAAAAAAAAAAAAAAAAAAAAAAD4AAHgAAAAAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAACAAA8AAAAAAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAPAADwAAAAAAAAAAAAf4AAAAAAAAAAAAAAAAAAAAAAAAcAA8AAAAAAAAAAAAB/AAAAAAAAAAAAAAAAAAAAAAAAAgAHwAAAAAAAAAAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAABgAAAAAAAAAAAAD/AAAAAAAAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAPwAAAAAAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAA/DgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAB4AAAABgwACAAAAAAAAAAAAAAAAAAfAAAAAAAAAAAAA/5AA///////8AAAAAAAAAAAAAAAADwAAAAAAAAAABh///gf////////4AAAAAAAAAAAAAAA/wAAAAAAAG/w/////P/////////+AAAAAAAAAAAQAAP/gAAAAA/////////////////////8AAAAAAAAAD8OA/+AAAAAf/////////////////////wAAAAAP//4P////4AAAAD/////////////////////+AAAAB/////////+AAAAD//////////////////////AAAAef/////////AAAAP//////////////////////4AAAf//////////AAD4P///////////////////////4AAA5/////////wAwfw////////////////////////gAAAP///////////H+f///////////////////////gAAAAP/////////////////////////////////////wAr4A//////////////////////////////////////+T//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////w=='
    const MASK_W = 256
    const MASK_H = 128
    const bin = atob(MASK_B64)
    const maskBytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) maskBytes[i] = bin.charCodeAt(i)

    const landAt = (x: number, y: number) => {
      const cx0 = x < 0 ? 0 : x >= MASK_W ? MASK_W - 1 : x
      const cy0 = y < 0 ? 0 : y >= MASK_H ? MASK_H - 1 : y
      const idx = cy0 * MASK_W + cx0
      return (maskBytes[idx >> 3] >> (7 - (idx & 7))) & 1
    }

    /* Bilinear coverage of a binary bitmap. A cell is 1.4° across, so the 0.5
       iso-line of this field is the only sub-cell coastline information the
       source data has — reading the bitmap per cell would throw it away. */
    const coverAt = (x: number, y: number) => {
      const x0 = Math.floor(x)
      const y0 = Math.floor(y)
      const fx = x - x0
      const fy = y - y0
      const gx = 1 - fx
      const gy = 1 - fy
      return (
        landAt(x0, y0) * gx * gy +
        landAt(x0 + 1, y0) * fx * gy +
        landAt(x0, y0 + 1) * gx * fy +
        landAt(x0 + 1, y0 + 1) * fx * fy
      )
    }

    /* ======================================================================
       Sampling. Deterministic xorshift so every repaint — including the static
       reduced-motion frame and a resize — draws the identical stipple.
       ====================================================================== */
    let seed = 0x9e3779b9
    const nextRandom = () => {
      seed ^= seed << 13
      seed >>>= 0
      seed ^= seed >>> 17
      seed ^= seed << 5
      seed >>>= 0
      return seed / 4294967296
    }

    /* Band count. The bands are equal-area, so a band's angular height is
       2/(M·cosφ) while the spacing inside it is 2π·Σcosφ/(N·cosφ); setting the
       two equal (square cells) gives M ≈ 0.636·√N. Getting this wrong is not
       subtle — 4:1 anisotropy lays the stipple out in visible latitude rows. */
    const BAND_ROWS = Math.max(8, Math.round(Math.sqrt(SAMPLE_COUNT * 0.405)))
    const bandWeight = new Float64Array(BAND_ROWS)
    let bandWeightSum = 0
    for (let i = 0; i < BAND_ROWS; i++) {
      const midSin = -1 + ((i + 0.5) * 2) / BAND_ROWS
      bandWeight[i] = Math.sqrt(Math.max(0, 1 - midSin * midSin)) // circumference ∝ cos(lat)
      bandWeightSum += bandWeight[i]
    }
    const pointsPerBand = SAMPLE_COUNT / bandWeightSum

    /* Jitter is in units of one sampling cell. With square cells, half a cell in
       each direction is the classic stratified jitter: no grid, no clumps. */
    const JITTER = 0.42
    const xs: number[] = []
    const ys: number[] = []
    const zs: number[] = []
    const tiers: number[] = []
    const jitters: number[] = []

    for (let i = 0; i < BAND_ROWS; i++) {
      const sin0 = -1 + (i * 2) / BAND_ROWS
      const sin1 = -1 + ((i + 1) * 2) / BAND_ROWS
      const count = Math.max(1, Math.round(bandWeight[i] * pointsPerBand))
      const phase = nextRandom() // per-band phase: no meridian-to-meridian alignment
      for (let j = 0; j < count; j++) {
        const lon = ((j + phase + (nextRandom() - 0.5) * JITTER) / count) * 360 - 180
        const sinLat = sin0 + (sin1 - sin0) * nextRandom()
        const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)))

        const m = coverAt(((lon + 180) / 360) * MASK_W, ((90 - lat / DEG) / 180) * MASK_H)
        if (m < 0.5) continue // ocean

        const cosLat = Math.cos(lat)
        const lonRad = lon * DEG
        xs.push(cosLat * Math.cos(lonRad))
        ys.push(sinLat)
        zs.push(cosLat * Math.sin(lonRad))
        tiers.push(m < 0.88 ? 1 : 0) // 1 = within half a cell of the coastline
        jitters.push(0.97 + nextRandom() * 0.06)
      }
    }
    const COUNT = xs.length
    const PX = Float32Array.from(xs)
    const PY = Float32Array.from(ys)
    const PZ = Float32Array.from(zs)
    const TIER = Uint8Array.from(tiers)
    const SIZE_JITTER = Float32Array.from(jitters)

    /* ======================================================================
       Hubs and routes. slerp between two unit vectors is the shortest path on
       the sphere — the arcs therefore foreshorten like everything else instead
       of bulging off the surface.
       ====================================================================== */
    const HUBS = [
      [-122.4, 37.8],
      [2.35, 48.85],
      [139.7, 35.7],
      [103.8, 1.35],
      [151.2, -33.9],
      [-46.6, -23.5],
      [72.9, 19.1],
      [-79.4, 43.7],
    ]
    const ARCS = [
      [0, 2],
      [0, 1],
      [2, 3],
      [1, 4],
      [3, 5],
      [0, 6],
      [4, 3],
    ]
    /* Periods and offsets are incommensurate on purpose: the seven pulses never
       fire in unison. */
    const ARC_PERIOD = [5200, 6084, 4316, 6812, 4732, 5668, 6396]
    const ARC_OFFSET = [0.0, 0.37, 0.71, 0.14, 0.55, 0.88, 0.26]

    const hub = HUBS.map((h) => {
      const la = h[1] * DEG
      const lo = h[0] * DEG
      const c = Math.cos(la)
      return [c * Math.cos(lo), Math.sin(la), c * Math.sin(lo)]
    })

    const arcPaths = ARCS.map(([a, b]) => {
      const A = hub[a]
      const B = hub[b]
      let dot = A[0] * B[0] + A[1] * B[1] + A[2] * B[2]
      dot = Math.max(-1, Math.min(1, dot))
      const omega = Math.acos(dot)
      const sinOmega = Math.sin(omega)
      const out = new Float32Array((ARC_SAMPLES + 1) * 3)
      for (let i = 0; i <= ARC_SAMPLES; i++) {
        const u = i / ARC_SAMPLES
        const k1 = sinOmega < 1e-6 ? 1 - u : Math.sin((1 - u) * omega) / sinOmega
        const k2 = sinOmega < 1e-6 ? u : Math.sin(u * omega) / sinOmega
        out[i * 3] = (A[0] * k1 + B[0] * k2) * ARC_LIFT
        out[i * 3 + 1] = (A[1] * k1 + B[1] * k2) * ARC_LIFT
        out[i * 3 + 2] = (A[2] * k1 + B[2] * k2) * ARC_LIFT
      }
      return out
    })

    /* ======================================================================
       Ink. Read from --foreground so the field follows the theme; alpha levels
       are quantised so the 16 shade bands can be cached as colour strings.
       ====================================================================== */
    const LIGHT_LEN = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2])
    const LX = LIGHT[0] / LIGHT_LEN
    const LY = LIGHT[1] / LIGHT_LEN
    const LZ = LIGHT[2] / LIGHT_LEN

    const parseRGB = (value: string): [number, number, number] | null => {
      const s = (value || '').trim()
      if (s.charAt(0) === '#') {
        let h = s.slice(1)
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
        return [
          Number.parseInt(h.slice(0, 2), 16),
          Number.parseInt(h.slice(2, 4), 16),
          Number.parseInt(h.slice(4, 6), 16),
        ]
      }
      const m = s.match(/rgba?\(([^)]+)\)/)
      if (m) {
        const p = m[1].split(',')
        return [Number.parseInt(p[0], 10), Number.parseInt(p[1], 10), Number.parseInt(p[2], 10)]
      }
      return null
    }

    let INK: [number, number, number] = [29, 29, 31]
    let inkCache: Record<number, string> = {}
    const bandInk: string[] = new Array(SHADE_BANDS)

    const ink = (a: number) => {
      const q = Math.round(Math.max(0, Math.min(1, a)) * 200)
      let s = inkCache[q]
      if (s === undefined) {
        s = `rgba(${INK[0]},${INK[1]},${INK[2]},${(q / 200).toFixed(3)})`
        inkCache[q] = s
      }
      return s
    }

    const readInk = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--foreground')
      const rgb = parseRGB(raw) || parseRGB(getComputedStyle(document.body).color)
      if (rgb) INK = rgb
      inkCache = {}
      /* The band fills are colour strings too — they must be rebuilt with the ink. */
      for (let k = 0; k < SHADE_BANDS; k++) {
        const t = (k + 0.5) / SHADE_BANDS
        bandInk[k] = ink(A_DARK + (A_LIT - A_DARK) * Math.pow(t, 1.05))
      }
    }

    /* ======================================================================
       Projection. Spin about the pole, then the fixed axial tilt.
       ====================================================================== */
    const CT = Math.cos(TILT)
    const ST = Math.sin(TILT)

    const smoothstep = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
      return t * t * (3 - 2 * t)
    }

    let W = 384
    let cx = 192
    let cy = 192
    let R = 192
    let spin = SPIN0

    const spherePt = (lat: number, lon: number, cs: number, ss: number) => {
      const la = lat * DEG
      const lo = lon * DEG
      const cl = Math.cos(la)
      const x0 = cl * Math.cos(lo)
      const y0 = Math.sin(la)
      const z0 = cl * Math.sin(lo)
      const x = x0 * cs - z0 * ss
      const z = x0 * ss + z0 * cs
      return [x, y0 * CT - z * ST, y0 * ST + z * CT] as const
    }

    const PARALLELS = [-60, -30, 0, 30, 60]
    const MERIDIANS: number[] = []
    for (let lo = -180; lo < 180; lo += 30) MERIDIANS.push(lo)

    /* Graticule: one hairline path, stroked with a gradient along the light
       axis. A uniform grid would stay equally bright on the dark side, which is
       the fastest way to make a sphere look like a wireframe rather than a body. */
    const drawGraticule = (cs: number, ss: number) => {
      const path = new Path2D()
      let pen = false
      let sx = 0
      let sy = 0
      for (let i = 0; i < PARALLELS.length; i++) {
        pen = false
        for (let lon = -180; lon <= 180; lon += 3) {
          const p = spherePt(PARALLELS[i], lon, cs, ss)
          if (p[2] <= Z_MIN) {
            pen = false
            continue
          }
          sx = cx + p[0] * R
          sy = cy - p[1] * R
          if (pen) path.lineTo(sx, sy)
          else {
            path.moveTo(sx, sy)
            pen = true
          }
        }
      }
      for (let i = 0; i < MERIDIANS.length; i++) {
        pen = false
        /* Stop short of the poles: twelve meridians converging on one point read
           as a starburst, the least sphere-like mark available. */
        for (let lat = -76; lat <= 76; lat += 3) {
          const p = spherePt(lat, MERIDIANS[i], cs, ss)
          if (p[2] <= Z_MIN) {
            pen = false
            continue
          }
          sx = cx + p[0] * R
          sy = cy - p[1] * R
          if (pen) path.lineTo(sx, sy)
          else {
            path.moveTo(sx, sy)
            pen = true
          }
        }
      }
      const g = ctx.createLinearGradient(
        cx - LX * R,
        cy + LY * R,
        cx + LX * R,
        cy - LY * R,
      )
      g.addColorStop(0, ink(GRID_ALPHA))
      g.addColorStop(0.46, ink(GRID_ALPHA * 0.5))
      g.addColorStop(1, ink(GRID_ALPHA * 0.1))
      ctx.strokeStyle = g
      ctx.lineWidth = GRID_WIDTH
      ctx.stroke(path)
    }

    /* The land. One Path2D per shade band, then SHADE_BANDS fills — this is
       what buys the density: 10k arcs per frame only work because the fills are
       batched. Each dot needs its own moveTo, otherwise Path2D.arc() joins the
       previous subpath and the field turns into a spiderweb. */
    const drawLand = (cs: number, ss: number) => {
      const paths: Path2D[] = []
      for (let k = 0; k < SHADE_BANDS; k++) paths.push(new Path2D())
      const invSpan = 1 / (1 - Z_MIN)

      for (let i = 0; i < COUNT; i++) {
        const x0 = PX[i]
        const y0 = PY[i]
        const z0 = PZ[i]
        const x = x0 * cs - z0 * ss
        const z = x0 * ss + z0 * cs
        const y2 = y0 * CT - z * ST
        const z2 = y0 * ST + z * CT
        if (z2 <= Z_MIN) continue // back of the sphere

        /* Light. The view-space normal is the rotated unit vector itself, so
           lambert is one dot product. Ink follows it continuously — the
           terminator is made of the dots, not of an overlay. */
        const lambert = x * LX + y2 * LY + z2 * LZ
        const lit = Math.min(1, Math.max(0, (lambert + 0.38) / 1.16))

        /* Silhouette dissolve: the last tenth of the radius loses ink per dot,
           so the limb fades out instead of being cut off. */
        const tone = lit * (0.55 + 0.45 * smoothstep(0.02, 0.22, z2))

        let band = (tone * SHADE_BANDS) | 0
        if (band >= SHADE_BANDS) band = SHADE_BANDS - 1
        if (TIER[i]) band = Math.min(SHADE_BANDS - 1, band + COAST_STEP)

        /* Radius follows depth only: projected area shrinks with cos, so the
           compressed rim reads as curvature rather than as a denser texture. */
        const shrink = R_LIMB + (1 - R_LIMB) * Math.pow((z2 - Z_MIN) * invSpan, 0.5)
        const radius = R_BASE * shrink * SIZE_JITTER[i] * (TIER[i] ? COAST_SIZE : 1)

        const sx = cx + x * R
        const sy = cy - y2 * R
        const path = paths[band]
        path.moveTo(sx + radius, sy)
        path.arc(sx, sy, radius, 0, TAU)
      }
      for (let k = 0; k < SHADE_BANDS; k++) {
        ctx.fillStyle = bandInk[k]
        ctx.fill(paths[k])
      }
    }

    /* Atmosphere: a whisper of ink just outside the limb, so the silhouette
       softens into the page instead of looking die-cut. Drawn behind the field —
       it must never dim a dot. */
    const drawAtmosphere = () => {
      const g = ctx.createRadialGradient(cx, cy, R * 0.93, cx, cy, R * 1.16)
      g.addColorStop(0, ink(0))
      g.addColorStop(0.38, ink(0.045))
      g.addColorStop(0.74, ink(0.014))
      g.addColorStop(1, ink(0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.16, 0, TAU)
      ctx.fill()
    }

    /* Horizon + catch-light. Land covers 29% of the sphere, so when an ocean
       faces the viewer the field alone cannot close the silhouette and the ball
       appears to lose a slice. A 0.035 hairline is enough to close it; the
       brighter arc on top of it is what sells the light direction. */
    const drawRim = () => {
      ctx.strokeStyle = ink(0.035)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R - 0.5, 0, TAU)
      ctx.stroke()

      const g = ctx.createLinearGradient(cx - LX * R, cy + LY * R, cx + LX * R, cy - LY * R)
      g.addColorStop(0, ink(0.085))
      g.addColorStop(0.42, ink(0.01))
      g.addColorStop(1, ink(0))
      ctx.strokeStyle = g
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(cx, cy, R - 0.8, 0, TAU)
      ctx.stroke()
    }

    /* Routes. The base curve is dotted by *screen* distance, not by parameter:
       a great circle foreshortens to almost nothing at the limb, so parametric
       sampling would stack a dozen dots on the same pixel and draw a solid
       scratch across the sphere. */
    const drawArcs = (cs: number, ss: number, tMs: number) => {
      for (let ai = 0; ai < arcPaths.length; ai++) {
        const P = arcPaths[ai]
        let pulseU = -1
        let envelope = 0
        const phase = (tMs / ARC_PERIOD[ai] + ARC_OFFSET[ai]) % 1
        if (phase < SWEEP) {
          pulseU = phase / SWEEP
          envelope = Math.min(1, 5 * Math.sin(Math.PI * pulseU))
        }

        let acc = ARC_GAP
        let lastSx = 0
        let lastSy = 0
        let hasPrev = false
        let pulseIdx = -1

        for (let i = 0; i <= ARC_SAMPLES; i++) {
          const x0 = P[i * 3]
          const y0 = P[i * 3 + 1]
          const z0 = P[i * 3 + 2]
          const x = x0 * cs - z0 * ss
          const z = x0 * ss + z0 * cs
          const y2 = y0 * CT - z * ST
          const z2 = y0 * ST + z * CT
          if (z2 <= Z_MIN) {
            hasPrev = false
            continue
          }

          const u = i / ARC_SAMPLES
          const sx = cx + x * R
          const sy = cy - y2 * R
          if (hasPrev) acc += Math.hypot(sx - lastSx, sy - lastSy)
          lastSx = sx
          lastSy = sy
          hasPrev = true
          if (pulseIdx < 0 && u >= pulseU) pulseIdx = i

          if (acc < ARC_GAP) continue
          acc = 0
          const a =
            ARC_BASE *
            Math.pow(Math.sin(Math.PI * u), 0.6) *
            (0.3 + 0.7 * smoothstep(0.06, 0.52, z2))
          if (a < 0.012) continue
          ctx.fillStyle = ink(a)
          ctx.beginPath()
          ctx.arc(sx, sy, 0.85, 0, TAU)
          ctx.fill()
        }

        /* Pulse: one saturated node plus a soft halo. It is the brightest ink on
           the canvas by construction — keep it that way. */
        if (pulseU >= 0 && pulseIdx >= 0 && envelope > 0.01) {
          const x0 = P[pulseIdx * 3]
          const y0 = P[pulseIdx * 3 + 1]
          const z0 = P[pulseIdx * 3 + 2]
          const x = x0 * cs - z0 * ss
          const z = x0 * ss + z0 * cs
          const y2 = y0 * CT - z * ST
          const z2 = y0 * ST + z * CT
          if (z2 > Z_MIN) {
            const sx = cx + x * R
            const sy = cy - y2 * R
            /* Fade as the route rounds the horizon, so the pulse never pops. */
            const strength = envelope * smoothstep(0.1, 0.4, z2)
            if (strength > 0.01) {
              ctx.fillStyle = ink(0.1 * strength)
              ctx.beginPath()
              ctx.arc(sx, sy, 4.6, 0, TAU)
              ctx.fill()
              ctx.fillStyle = ink(0.4 + 0.58 * strength)
              ctx.beginPath()
              ctx.arc(sx, sy, 1.5 + 0.7 * strength, 0, TAU)
              ctx.fill()
            }
          }
        }
      }
    }

    /* Hub nodes: a solid dot plus a hairline halo. Kept below full ink so the
       travelling pulse stays the only saturated mark. */
    const drawHubs = (cs: number, ss: number) => {
      for (let i = 0; i < hub.length; i++) {
        const v = hub[i]
        const x = v[0] * cs - v[2] * ss
        const z = v[0] * ss + v[2] * cs
        const y2 = v[1] * CT - z * ST
        const z2 = v[1] * ST + z * CT
        if (z2 <= Z_MIN) continue
        const hx = cx + x * R
        const hy = cy - y2 * R
        const scale = 0.7 + 0.3 * z2
        ctx.fillStyle = ink(0.42 + 0.5 * z2)
        ctx.beginPath()
        ctx.arc(hx, hy, 3.1 * scale, 0, TAU)
        ctx.fill()
        ctx.strokeStyle = ink(0.06 + 0.1 * z2)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(hx, hy, 9.5 * scale, 0, TAU)
        ctx.stroke()
      }
    }

    /* Paint order matters: atmosphere behind everything (it must not dim a dot),
       graticule below the land in weight, the horizon last before the overlay so
       it sits under the routes. */
    const draw = (angle: number, tMs: number) => {
      LAST = angle
      spin = angle
      ctx.clearRect(0, 0, W, W)
      const cs = Math.cos(angle)
      const ss = Math.sin(angle)
      drawAtmosphere()
      drawGraticule(cs, ss)
      drawLand(cs, ss)
      drawRim()
      drawArcs(cs, ss, tMs)
      drawHubs(cs, ss)
    }

    /* ★ Assigning `canvas.width` / `canvas.height` CLEARS the bitmap. Previously the
       repaint only happened inside the rAF `tick`, so any resize that arrived while the
       loop was not ticking left a BLANK sphere — which is exactly what happened when the
       page was captured full-page (Chrome's `captureBeyondViewport` resizes the viewport
       first), and it is also reachable in the wild: resize the window while the globe is
       scrolled out of view (`stop()` has cancelled the loop) and the band comes back
       empty. Repainting at the last angle inside resize() closes both holes. */
    let LAST = SPIN0
    let dragging = false
    let pointerId: number | null = null
    let lastX = 0
    let lastMoveT = 0
    const nowMs = () => (window.performance ? window.performance.now() : Date.now())

    const resize = () => {
      const cssW = canvasEl.clientWidth || 384
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvasEl.width = Math.round(cssW * dpr)
      canvasEl.height = Math.round(cssW * dpr)
      W = cssW
      cx = cssW / 2
      cy = cssW / 2
      R = (cssW / 2) * FIT
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(LAST, nowMs()) // repaint immediately — never leave it blank
    }

    /* One accumulated angle drives everything. While dragging the pointer owns
       it; after release momentum decays exponentially until it falls to the auto
       drift speed and the steady rotation simply takes over — no seam, no snap.
       dt is clamped so a long off-screen pause cannot teleport the ball. */
    const AUTO_OMEGA = (Math.PI * 2) / AUTO_PERIOD
    let vel = 0
    let rafId: number | null = null
    let running = false
    let lastTs = 0

    const tick = (ts: number) => {
      const dt = lastTs ? Math.min(ts - lastTs, 50) : 16
      lastTs = ts
      if (!dragging) {
        if (Math.abs(vel) > AUTO_OMEGA) {
          spin += vel * dt
          vel *= Math.exp(-dt / INERTIA_TAU)
        } else {
          vel = 0
          spin += AUTO_OMEGA * dt
        }
      }
      draw(spin, ts)
      rafId = requestAnimationFrame(tick)
    }
    const start = () => {
      if (running || reduce) return
      running = true
      lastTs = 0
      rafId = requestAnimationFrame(tick)
    }
    const stop = () => {
      running = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      lastTs = 0
    }

    /* Drag to spin. Pointer events so mouse, pen and touch all work. The canvas
       only captures the pointer while a drag is actually in flight, and its
       touch-action is `pan-y` (see the className) so a vertical swipe still
       scrolls the page — the browser then fires pointercancel and we let go. */
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      dragging = true
      pointerId = e.pointerId
      lastX = e.clientX
      lastMoveT = nowMs()
      vel = 0
      canvasEl.dataset.dragging = 'true'
      if (canvasEl.setPointerCapture) {
        try {
          canvasEl.setPointerCapture(e.pointerId)
        } catch {
          /* not capturable */
        }
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return
      const t = nowMs()
      const dt = Math.max(1, t - lastMoveT)
      const dSpin = -(e.clientX - lastX) * (Math.PI / (2 * R)) * DRAG_GAIN
      spin += dSpin
      vel = vel * 0.6 + (dSpin / dt) * 0.4
      lastX = e.clientX
      lastMoveT = t
      if (reduce) draw(spin, 0) // no loop to paint for us
    }
    const endDrag = (e: PointerEvent) => {
      if (!dragging || (e.pointerId !== undefined && e.pointerId !== pointerId)) return
      dragging = false
      delete canvasEl.dataset.dragging
      if (pointerId !== null && canvasEl.releasePointerCapture) {
        try {
          canvasEl.releasePointerCapture(pointerId)
        } catch {
          /* already gone */
        }
      }
      pointerId = null
      if (reduce) vel = 0 // nothing may keep moving on its own
    }

    let gio: IntersectionObserver | null = null
    let themeObs: MutationObserver | null = null

    readInk() // must precede resize() — resize() now paints
    resize()
    if (!reduce) {
      if ('IntersectionObserver' in window) {
        gio = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) start()
              else stop()
            })
          },
          { threshold: 0 },
        )
        gio.observe(canvasEl)
      }
      start()
    }
    canvasEl.addEventListener('pointerdown', onPointerDown)
    canvasEl.addEventListener('pointermove', onPointerMove)
    canvasEl.addEventListener('pointerup', endDrag)
    canvasEl.addEventListener('pointercancel', endDrag)
    canvasEl.addEventListener('lostpointercapture', endDrag)

    /* Theme follow — re-read --foreground when the root class flips, and repaint
       unconditionally: with the loop paused (globe off-screen) a bare readInk()
       would leave the sphere painted in the previous theme's ink. */
    if (window.MutationObserver) {
      themeObs = new MutationObserver(() => {
        readInk()
        draw(LAST, nowMs())
      })
      themeObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      })
    }
    const onResize = () => resize()
    window.addEventListener('resize', onResize)
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
