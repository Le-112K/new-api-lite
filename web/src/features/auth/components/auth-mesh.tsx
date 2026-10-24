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
 * AuthMesh — the animated dot mesh behind the login panel.
 *
 * A hex-offset lattice with three layers of motion:
 *  1. two travelling sine waves (different speed and pitch) so the drift never
 *     reads as a single loop;
 *  2. a per-point breathing phase that modulates both dot size and ink, which
 *     is what gives the field a slow "surface" rather than a static grid;
 *  3. a smoothed pointer repulsion — the cursor sets a target, the field eases
 *     toward it at 14%/frame, so the bend glides instead of snapping.
 *
 * A soft radial halo follows the same smoothed pointer, and a centre-weighted
 * alpha falloff keeps the edges quiet without relying on the CSS mask alone.
 *
 * Engineering contract:
 * - DPR capped at 2; canvas rebuilt through ResizeObserver.
 * - prefers-reduced-motion renders one static frame and stops the RAF loop.
 * - RAF pauses while the document is hidden.
 * - Decorative: aria-hidden, no pointer capture.
 */
export function AuthMesh(props: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    const GAP = 22 // lattice pitch, css px
    const WAVE_A = 3.2 // primary wave amplitude
    const WAVE_B = 1.8 // secondary wave amplitude
    const INFLUENCE = 130 // pointer radius
    const PUSH = 20 // max displacement away from the pointer
    const EASE = 0.14 // pointer smoothing per frame

    let raf = 0
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let points: {
      x: number
      y: number
      ox: number
      oy: number
      phase: number
    }[] = []
    const target = { x: -9999, y: -9999, strength: 0 }
    const pointer = { x: -9999, y: -9999, strength: 0 }

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      cols = Math.ceil(width / GAP) + 2
      rows = Math.ceil(height / GAP) + 2
      points = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * GAP + (r % 2 ? GAP / 2 : 0)
          const y = r * GAP
          // Deterministic per-point phase so the breathing never syncs up.
          const phase = Math.sin((r * cols + c) * 12.9898) * 43758.5453
          points.push({ x, y, ox: x, oy: y, phase: phase - Math.floor(phase) })
        }
      }
    }

    const draw = (time: number) => {
      const t = time / 1000
      ctx.clearRect(0, 0, width, height)

      if (!reduce) {
        pointer.x += (target.x - pointer.x) * EASE
        pointer.y += (target.y - pointer.y) * EASE
        pointer.strength += (target.strength - pointer.strength) * 0.1
      } else {
        pointer.x = target.x
        pointer.y = target.y
        pointer.strength = target.strength
      }

      const cx = width / 2
      const cy = height / 2
      const maxR = Math.hypot(cx, cy) || 1

      for (const p of points) {
        let x = p.ox
        let y = p.oy
        if (!reduce) {
          y +=
            Math.sin(p.ox * 0.018 + p.oy * 0.013 - t * 0.7) * WAVE_A +
            Math.sin(p.ox * 0.007 - t * 0.35) * WAVE_B
          x += Math.sin(p.oy * 0.011 + t * 0.22) * 1.1
        }
        if (pointer.strength > 0.01) {
          const dx = x - pointer.x
          const dy = y - pointer.y
          const dist = Math.hypot(dx, dy)
          if (dist < INFLUENCE && dist > 0.01) {
            const force = (1 - dist / INFLUENCE) * pointer.strength
            x += (dx / dist) * force * PUSH
            y += (dy / dist) * force * PUSH
          }
        }
        p.x = x
        p.y = y
      }

      // Links first — a faint weave, never a net.
      ctx.lineWidth = 0.7
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.beginPath()
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const p = points[i]
          if (!p) continue
          const right = points[i + 1]
          if (right && c < cols - 1) {
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(right.x, right.y)
          }
          const down = points[i + cols]
          if (down) {
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(down.x, down.y)
          }
        }
      }
      ctx.stroke()

      // Cursor halo: a soft bloom that makes the bend legible on ink.
      if (pointer.strength > 0.02) {
        const halo = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          INFLUENCE * 1.4
        )
        halo.addColorStop(0, `rgba(255,255,255,${0.07 * pointer.strength})`)
        halo.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = halo
        ctx.fillRect(0, 0, width, height)
      }

      for (const p of points) {
        const radial = 1 - (Math.hypot(p.ox - cx, p.oy - cy) / maxR) * 0.45
        const breath = reduce
          ? 0.75
          : 0.62 + 0.38 * Math.sin(t * 0.7 + p.phase * Math.PI * 2)
        let near = 0
        if (pointer.strength > 0.01) {
          const d = Math.hypot(p.x - pointer.x, p.y - pointer.y)
          if (d < INFLUENCE) near = (1 - d / INFLUENCE) * pointer.strength
        }
        const alpha = Math.min(
          0.82,
          (0.1 + 0.18 * breath) * radial + near * 0.55
        )
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 0.95 + breath * 0.35 + near * 1.05, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (time: number) => {
      draw(time)
      raf = window.requestAnimationFrame(loop)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const inside =
        x >= -40 && y >= -40 && x <= rect.width + 40 && y <= rect.height + 40
      target.x = x
      target.y = y
      target.strength = inside ? 1 : 0
      if (reduce) draw(0)
    }

    const onPointerLeave = () => {
      target.strength = 0
      if (reduce) draw(0)
    }

    const onVisibility = () => {
      window.cancelAnimationFrame(raf)
      if (!document.hidden && !reduce) {
        raf = window.requestAnimationFrame(loop)
      }
    }

    build()
    draw(0)
    if (!reduce) raf = window.requestAnimationFrame(loop)

    const observer = new ResizeObserver(() => {
      build()
      draw(performance.now())
    })
    observer.observe(canvas)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className={cn('block h-full w-full', props.className)}
    />
  )
}
