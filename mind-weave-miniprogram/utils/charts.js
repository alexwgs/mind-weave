const { fmtShort } = require('./format')

function getCanvas(that, id) {
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(that)
      .select('#' + id)
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          resolve(null)
          return
        }
        const { node: canvas, width, height } = res[0]
        const dpr = ((wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio) || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        resolve({ ctx, W: width, H: height })
      })
  })
}

function drawEmpty(ctx, W, H) {
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#b0b6c0'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('暂无数据', W / 2, H / 2)
}

function drawGrid(ctx, W, H, padL, padR, padT, innerH) {
  ctx.strokeStyle = '#eef0f4'
  ctx.lineWidth = 1
  for (let i = 0; i <= 2; i++) {
    const y = padT + (innerH * i) / 2
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(W - padR, y)
    ctx.stroke()
  }
}

function drawLine(that, id, labels, values) {
  getCanvas(that, id).then((env) => {
    if (!env) return
    const { ctx, W, H } = env
    ctx.clearRect(0, 0, W, H)
    if (!values || !values.length) {
      drawEmpty(ctx, W, H)
      return
    }
    const padL = 10
    const padR = 10
    const padT = 26
    const padB = 28
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    const max = Math.max.apply(null, values) * 1.15 || 1
    drawGrid(ctx, W, H, padL, padR, padT, innerH)
    const step = values.length > 1 ? innerW / (values.length - 1) : 0
    const pts = values.map((v, i) => ({
      x: padL + step * i,
      y: padT + innerH - (v / max) * innerH
    }))
    ctx.strokeStyle = '#0061FF'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = '#0061FF'
    pts.forEach((p, i) => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
      if (values.length <= 12) {
        ctx.fillStyle = '#4e5561'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(fmtShort(values[i]), p.x, p.y - 8)
        ctx.fillStyle = '#0061FF'
      }
    })
    ctx.fillStyle = '#8a8f99'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    if (labels.length <= 6) {
      labels.forEach((lb, i) => ctx.fillText(lb, pts[i].x, H - 8))
    } else {
      ctx.fillText(labels[0], pts[0].x, H - 8)
      ctx.fillText(labels[labels.length - 1], pts[pts.length - 1].x, H - 8)
    }
  })
}

function drawBar(that, id, labels, values, colors) {
  getCanvas(that, id).then((env) => {
    if (!env) return
    const { ctx, W, H } = env
    ctx.clearRect(0, 0, W, H)
    if (!values || !values.length) {
      drawEmpty(ctx, W, H)
      return
    }
    const padL = 10
    const padR = 10
    const padT = 26
    const padB = 28
    const innerW = W - padL - padR
    const innerH = H - padT - padB
    const max = Math.max.apply(null, values) * 1.15 || 1
    drawGrid(ctx, W, H, padL, padR, padT, innerH)
    const n = values.length
    const gap = 14
    const bw = Math.min(36, (innerW - gap * (n - 1)) / n)
    const totalW = bw * n + gap * (n - 1)
    const x0 = padL + (innerW - totalW) / 2
    values.forEach((v, i) => {
      const h = Math.max(2, (v / max) * innerH)
      const x = x0 + i * (bw + gap)
      const y = padT + innerH - h
      ctx.fillStyle = (colors && colors[i]) || '#0061FF'
      ctx.fillRect(x, y, bw, h)
      ctx.fillStyle = '#4e5561'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(fmtShort(v), x + bw / 2, y - 5)
      ctx.fillStyle = '#8a8f99'
      ctx.fillText(labels[i], x + bw / 2, H - 8)
    })
  })
}

module.exports = {
  drawLine,
  drawBar
}
