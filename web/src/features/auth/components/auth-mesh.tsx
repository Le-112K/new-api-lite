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
 * A hex-offset lattice that breathes on a slow travelling wave and bends away
 * from the pointer inside a 120px radius. Neighbour links are drawn at very low
 * alpha so the field reads as a surface rather than confetti; the point nearest
 * the cursor gains size and ink, which is what makes the panel feel responsive
 * without any chrome.
 *
 * Engineering contract (same as ApertureGlobe):
 * - DPR capped at 2; canvas resized through ResizeObserver.
 * - `prefers-reduced-motion` renders one static frame and stops the RAF loop.
 * - The loop pauses while the document is hidden.
 * - The canvas is decorative: `aria-hidden`, pointer events stay with the panel.
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

    const GAP = 26 // lattice pitch in css px
    const WAVE_AMP = 4 // vertical breathing amplitude
    const WAVE_SPEED = 0.8 // radians per second
    const INFLUENCE = 120 // pointer radius
    const PUSH = 18 // max displacement away from the pointer

    let raf = 0
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let points: { x: number; y: number; ox: number; oy: number }[] = []
    let pointer = { x: -9999, y: -9999, active: false }

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
          // Hex offset on odd rows — a square lattice looks like graph paper.
          const x = c * GAP + (r % 2 ? GAP / 2 : 0)
          const y = r * GAP
          points.push({ x, y, ox: x, oy: y })
        }
      }
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)
      const t = time / 1000

      for (const p of points) {
        let x = p.ox
        let y = p.oy
        if (!reduce) {
          y +=
            Math.sin(p.ox * 0.018 + p.oy * 0.012 - t * WAVE_SPEED) * WAVE_AMP
        }
        if (pointer.active) {
          const dx = x - pointer.x
          const dy = y - pointer.y
          const dist = Math.hypot(dx, dy)
          if (dist < INFLUENCE && dist > 0.01) {
            const force = 1 - dist / INFLUENCE
            x += (dx / dist) * force * PUSH
            y += (dy / dist) * force * PUSH
          }
        }
        p.x = x
        p.y = y
      }

      // Links first, points on top — the lattice reads as a surface.
      ctx.lineWidth = 0.75
      ctx.strokeStyle = 'rgba(255,255,255,0.095)'
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

      for (const p of points) {
        let near = 0
        if (pointer.active) {
          const d = Math.hypot(p.x - pointer.x, p.y - pointer.y)
          if (d < INFLUENCE) near = 1 - d / INFLUENCE
        }
        ctx.fillStyle = `rgba(255,255,255,${(0.26 + near * 0.55).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, 1.15 + near * 0.95, 0, Math.PI * 2)
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
      pointer = {
        x,
        y,
        active: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height,
      }
      if (reduce) draw(0)
    }

    const onPointerLeave = () => {
      pointer = { x: -9999, y: -9999, active: false }
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
