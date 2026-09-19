export default function BrandMark({ className = '' }) {
  return <span className={`brand-mark ${className}`} aria-hidden="true">
    <svg viewBox="0 0 36 36" fill="none"><path d="M18 28V17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M18 20C7 20 6 14 7 8c7 0 12 3 11 12Z" fill="currentColor"/><path d="M18 15C18 7 23 4 30 5c0 7-4 11-12 10Z" fill="currentColor" opacity=".65"/><path d="M11 29h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
  </span>
}
