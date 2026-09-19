import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

export function useIsDesktop(breakpoint = 992) {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= breakpoint)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= breakpoint)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [breakpoint])
  return isDesktop
}

export function useEChart(option, deps = []) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chart.setOption(option)
    const handler = () => chart.resize()
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      chart.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return ref
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
