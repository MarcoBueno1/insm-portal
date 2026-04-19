import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/',             icon: '📊', label: 'Dashboard',       section: 'Visão Geral' },
  { to: '/mural',        icon: '📌', label: 'Mural de Avisos',  section: 'Comunicação' },
  { to: '/coordenadores',icon: '👥', label: 'Coordenadores',    section: 'Comunicação' },
  { to: '/atividades',   icon: '🗓️', label: 'Planejamento',     section: 'Atividades' },
  { to: '/registros',    icon: '📸', label: 'Registros & Fotos', section: 'Atividades' },
  { to: '/metricas',     icon: '📈', label: 'Métricas',         section: 'Atividades' },
  { to: '/estoque',      icon: '📦', label: 'Estoque',          section: 'Gestão' },
  { to: '/materiais',    icon: '🛒', label: 'Compras',          section: 'Gestão' },
  { to: '/usuarios',     icon: '🔐', label: 'Usuários',         section: 'Admin', adminOnly: true },
]

export default function Layout() {
  const { user, perfil, nomeUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = nomeUser.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  // Group nav by section
  const sections = {}
  NAV.forEach(item => {
    if (item.adminOnly && !isAdmin) return
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  })

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 199, display: 'none'
        }} className="mobile-overlay" />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside style={{
        width: '256px',
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0d1f42 0%, #1a3a6b 60%, #1e4578 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0, top: 0,
        zIndex: 200,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: '26px 20px 20px',
          textAlign: 'center',
          borderBottom: '1px solid rgba(201,162,39,0.2)',
        }}>
          <div style={{ fontSize: '38px', marginBottom: '8px', filter: 'drop-shadow(0 2px 8px rgba(201,162,39,0.5))' }}>✦</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            color: 'white',
            fontSize: '15px',
            fontWeight: '700',
            lineHeight: '1.4',
            marginBottom: '4px'
          }}>Instituto Nossa<br />Senhora Menina</div>
          <div style={{
            fontSize: '9.5px',
            color: 'var(--dourado-cl)',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontWeight: '700'
          }}>Portal Administrativo</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div style={{
                fontSize: '9.5px',
                color: 'rgba(201,162,39,0.65)',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontWeight: '800',
                padding: '14px 10px 6px',
              }}>{section}</div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '11px',
                    padding: '9px 13px',
                    borderRadius: '9px',
                    marginBottom: '2px',
                    color: isActive ? 'var(--dourado-cl)' : 'rgba(255,255,255,0.72)',
                    background: isActive ? 'rgba(201,162,39,0.18)' : 'transparent',
                    border: isActive ? '1px solid rgba(201,162,39,0.28)' : '1px solid transparent',
                    fontSize: '13.5px',
                    fontWeight: isActive ? '700' : '500',
                    textDecoration: 'none',
                    transition: 'all 0.18s',
                    fontFamily: 'var(--font-body)',
                  })}
                  onMouseEnter={e => {
                    if (!e.currentTarget.style.background.includes('rgba(201')) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                      e.currentTarget.style.color = 'white'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.background = ''
                      e.currentTarget.style.color = ''
                    }
                  }}
                >
                  <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: '14px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
        }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, var(--dourado), var(--dourado-cl))',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '800', fontSize: '13px', color: 'var(--azul)',
            flexShrink: 0,
            fontFamily: 'var(--font-body)',
          }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', color: 'white', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nomeUser}
            </div>
            <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', textTransform: 'capitalize' }}>
              {perfil?.perfil || 'leitura'}
            </div>
          </div>
          <button onClick={handleLogout} title="Sair" style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none', color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer', padding: '7px 9px',
            borderRadius: '7px', fontSize: '13px',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.15)'; e.target.style.color = 'white' }}
            onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = 'rgba(255,255,255,0.45)' }}
          >⏏</button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <div style={{ marginLeft: '256px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <main style={{ flex: 1, padding: '28px 32px', maxWidth: '1400px', width: '100%' }}>
          <Outlet />
        </main>
        <footer style={{
          padding: '16px 32px',
          background: 'white',
          borderTop: '1px solid var(--borda)',
          textAlign: 'center',
          fontSize: '11.5px',
          color: 'var(--cinza)',
        }}>
          ✦ Instituto Nossa Senhora Menina · Portal Administrativo · Tecnologias 100% Gratuitas
        </footer>
      </div>
    </div>
  )
}
