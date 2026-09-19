import { useEffect, useRef, useState } from 'react'

/**
 * 菌丝体：一层悬浮在首屏背后的 3D 知识网络。
 * 用 Canvas 手写透视投影 —— 节点是真的分布在三维空间里，而不是贴图或渐变。
 * 指针移动带动相机旋转，滚动带动景深推移；hover 某个群落时，只有该群落的节点亮起来。
 */

const PALETTE = ['#4fd39a', '#d9a06a', '#8fb3a1', '#c3a2d8', '#7fc7c4', '#e0c46a']

/** 稳定地把分类映射到色板，保证同一次会话内颜色一致 */
export function colorForCategory(category) {
  if (!category) return PALETTE[2]
  if (colorForCategory._cache.has(category)) return colorForCategory._cache.get(category)
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0
  const color = PALETTE[h % PALETTE.length]
  colorForCategory._cache.set(category, color)
  return color
}
colorForCategory._cache = new Map()

const FOCAL = 620

export default function MyceliumCanvas({ focusCategory, categories = [] }) {
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)
  // 分类只在“集合发生变化”时重新归属，避免每次渲染都打散网络结构
  const categoriesKey = categories.join('|')
  const assignRef = useRef(null)
  const scrollRef = useRef(0)
  const categoriesRef = useRef(categories)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    // 只在真正的指针设备上启用鼠标视差，触屏不做无意义的抖动
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let width = 0
    let height = 0
    let nodes = []
    let edges = []
    let raf = 0
    let last = 0
    let elapsed = 0
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const focus = { amount: 0, target: 0, category: null }

    const buildNodes = (w, h) => {
      const span = Math.min(w, h)
      const spread = span * 0.47
      const count = Math.max(72, Math.min(200, Math.round((w * h) / 9200)))
      nodes = Array.from({ length: count }, () => {
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * spread
        return {
          x: Math.cos(a) * r,
          y: (Math.random() - 0.5) * span * 0.46,
          z: Math.sin(a) * r,
          baseX: 0, baseY: 0, baseZ: 0,
          phase: Math.random() * Math.PI * 2,
          speed: 0.35 + Math.random() * 0.75,
          r: 1.1 + Math.random() * 1.8,
          links: 0,
          sx: 0, sy: 0, depth: 1, opacity: 0,
          category: null,
        }
      })
      const linkDist = Math.min(w, h) * 0.235
      const maxSq = linkDist * linkDist
      const built = []
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dz = a.z - b.z
          const distSq = dx * dx + dy * dy + dz * dz
          if (distSq < maxSq) {
            built.push({ a, b, t: 1 - Math.sqrt(distSq) / linkDist })
            a.links++
            b.links++
          }
        }
      }
      edges = built
    }

    // 分类 -> 节点的稳定归属，保证聚焦时网络结构不会重排
    const assignCategories = (list) => {
      nodes.forEach((n, i) => {
        n.category = list.length ? list[i % list.length] : null
      })
      // 每个分类都必须真的有节点，否则聚焦某个群落会变成"全灭"
      const missing = list.filter((c) => !nodes.some((n) => n.category === c))
      missing.forEach((c, k) => {
        if (nodes.length) nodes[k % nodes.length].category = c
      })
    }
    assignRef.current = assignCategories

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (w < 2 || h < 2) return
      const changed = Math.abs(w - width) > 2 || Math.abs(h - height) > 2
      if (!changed && nodes.length) return
      width = w
      height = h
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!nodes.length) buildNodes(w, h)
      else rebuildPositions()
      setReady(true)
      if (reduce) draw(0)
    }

    const rebuildPositions = () => {
      const span = Math.min(width, height)
      const spread = span * 0.47
      // 保留已有的分类归属与相位，只重算几何，避免 resize 后颜色乱跳
      nodes.forEach((n) => {
        const a = Math.atan2(n.z, n.x)
        const r = Math.min(Math.hypot(n.x, n.z), spread)
        n.x = Math.cos(a) * r
        n.z = Math.sin(a) * r
        n.y = Math.max(-span * 0.23, Math.min(span * 0.23, n.y))
      })
      const linkDist = span * 0.235
      const maxSq = linkDist * linkDist
      const built = []
      nodes.forEach((n) => { n.links = 0 })
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dz = a.z - b.z
          const distSq = dx * dx + dy * dy + dz * dz
          if (distSq < maxSq) {
            built.push({ a, b, t: 1 - Math.sqrt(distSq) / linkDist })
            a.links++
            b.links++
          }
        }
      }
      edges = built
    }

    const draw = (dt) => {
      if (!width || !height) return
      const cx = width / 2
      const cy = height / 2
      const span = Math.min(width, height)

      ctx.clearRect(0, 0, width, height)

      // 相机：指针驱动 + 缓慢自转，并随滚动向景深里推进
      const rotY = elapsed * 0.045 + pointer.x * 0.4
      const rotX = -pointer.y * 0.26 + Math.sin(elapsed * 0.13) * 0.03
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX)
      const drift = Math.max(-60, Math.min(60, scrollRef.current * 22))

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        // 每根菌丝都有自己的呼吸
        const bob = Math.sin(elapsed * n.speed + n.phase) * 10
        const ex = n.x
        const ey = n.y + bob
        const ez = n.z

        const x1 = ex * cosY - ez * sinY
        const z1 = ex * sinY + ez * cosY
        const y1 = ey * cosX - z1 * sinX
        const z2 = ey * sinX + z1 * cosX + 700 + drift

        const depth = Math.max(0.3, z2 / (FOCAL + 700))
        n.baseX = cx + (x1 * FOCAL) / z2
        n.baseY = cy + (y1 * FOCAL) / z2
        n.depth = depth
        n.opacity = Math.max(0.06, Math.min(0.72, (1 - (depth - 0.55) * 1.5) * 0.7))
      }

      if (focus.category) {
        focus.amount += (1 - focus.amount) * Math.min(1, dt * 4.5)
      } else {
        focus.amount += (0 - focus.amount) * Math.min(1, dt * 4.5)
      }

      // 边：按透明度分箱批量描边，避免上千次 strokeStyle 切换
      const bins = new Map()
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]
        const related = !focus.category || e.a.category === focus.category || e.b.category === focus.category
        let alpha = e.t * 0.42 * (1 - focus.amount * 0.72)
        if (focus.category && related) alpha += e.t * 0.6 * focus.amount
        if (alpha < 0.012) continue
        const bin = Math.min(16, Math.round(alpha * 20))
        let bucket = bins.get(bin)
        if (!bucket) { bucket = []; bins.set(bin, bucket) }
        bucket.push(e)
      }
      ctx.lineWidth = 0.7
      bins.forEach((bucket, bin) => {
        ctx.strokeStyle = `rgba(143,179,161,${Math.min(0.6, bin / 20).toFixed(3)})`
        ctx.beginPath()
        for (let k = 0; k < bucket.length; k++) {
          const e = bucket[k]
          ctx.moveTo(e.a.baseX, e.a.baseY)
          ctx.lineTo(e.b.baseX, e.b.baseY)
        }
        ctx.stroke()
      })

      // 节点：远端几乎融进背景，近端才亮起来
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const match = !focus.category || n.category === focus.category
        const dim = focus.category && !match ? 1 - focus.amount * 0.86 : 1
        const lift = focus.category && match ? focus.amount * 0.55 : 0

        // 越靠边的节点越淡，避免出现被裁切的硬边
        const edgeFade = Math.max(0, Math.min(1, Math.min(n.baseX, width - n.baseX) / (span * 0.16))) *
          Math.max(0, Math.min(1, Math.min(n.baseY, height - n.baseY) / (span * 0.16)))
        const pulse = 0.78 + 0.22 * Math.sin(elapsed * n.speed * 1.7 + n.phase)
        const opacity = Math.min(0.95, (n.opacity + lift) * pulse * edgeFade * dim)
        if (opacity <= 0.015) continue

        const radius = (n.r + (n.links > 5 ? 0.7 : 0)) * (1 + lift * 0.9) * (0.82 + (1 - n.depth) * 0.5)
        n.sx = n.baseX
        n.sy = n.baseY

        const color = n.category ? colorForCategory(n.category) : PALETTE[2]

        // 亮节点给一圈柔光，像是会发光的孢子
        if (opacity > 0.3) {
          const glowR = radius * 5.2
          const g = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, glowR)
          g.addColorStop(0, hexToRgba(color, opacity * 0.34))
          g.addColorStop(1, hexToRgba(color, 0))
          ctx.fillStyle = g
          ctx.beginPath()
          ctx.arc(n.sx, n.sy, glowR, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.fillStyle = hexToRgba(color, opacity)
        ctx.beginPath()
        ctx.arc(n.sx, n.sy, Math.max(0.6, radius), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (time) => {
      if (!last) last = time
      const dt = Math.min(0.05, (time - last) / 1000)
      last = time
      elapsed += dt
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.4)
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.4)
      draw(dt)
      raf = window.requestAnimationFrame(loop)
    }

    const onPointerMove = (e) => {
      if (!canHover) return
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      pointer.tx = Math.max(-1, Math.min(1, nx))
      pointer.ty = Math.max(-1, Math.min(1, ny))
    }

    const onScroll = () => {
      const parent = canvas.parentElement
      const top = parent ? parent.getBoundingClientRect().top : 0
      scrollRef.current = Math.max(0, Math.min(1, -top / Math.max(1, height)))
    }

    const observer = new ResizeObserver(resize)
    if (canvas.parentElement) observer.observe(canvas.parentElement)
    resize()
    assignCategories(categoriesRef.current)
    onScroll()

    if (!reduce) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('scroll', onScroll, { passive: true })
      raf = window.requestAnimationFrame(loop)
    }

    return () => {
      observer.disconnect()
      assignRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    categoriesRef.current = categories
    if (assignRef.current) assignRef.current(categories)
  }, [categoriesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className={`mycelium-canvas${ready ? ' is-ready' : ''}`} aria-hidden="true" />
}

function hexToRgba(hex, alpha) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`
}
