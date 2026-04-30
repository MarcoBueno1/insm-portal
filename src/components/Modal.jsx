import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'

export default function Modal({ open, onClose, title, children, footer, size = '' }) {
  const bodyRef = useRef(null)

  useEffect(() => {
    if (open) {
      // Salva a posição de scroll atual e trava apenas o body, não o modal
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflowY = 'scroll'
    } else {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflowY = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
    return () => {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflowY = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
  }, [open])

  if (!open) return null

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,20,40,0.58)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '20px 16px 60px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={bodyRef}
        style={{
          background: 'white',
          borderRadius: 18,
          width: '100%',
          maxWidth: size === 'lg' ? 680 : 540,
          maxHeight: 'calc(100vh - 80px)',
          boxShadow: '0 20px 70px rgba(0,0,0,0.28)',
          animation: 'modalIn .25s ease',
          marginTop: 'auto',
          marginBottom: 'auto',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--borda)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--creme), white)',
          borderRadius: '18px 18px 0 0',
          flexShrink: 0,
        }}>
          <h3 style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--azul)', fontWeight:700, margin:0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--cinza)', padding:'6px 8px', borderRadius:6, lineHeight:1, minWidth:34, minHeight:34, display:'flex', alignItems:'center', justifyContent:'center' }}
          >✕</button>
        </div>

        {/* Body — rola aqui dentro */}
        <div style={{ padding: '22px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--borda)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            background: 'var(--creme)',
            borderRadius: '0 0 18px 18px',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )

  // Renderiza no portal para escapar de qualquer overflow hidden
  return ReactDOM.createPortal(modalContent, document.body)
}
