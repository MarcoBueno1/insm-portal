import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

const NAV = [
  { to:'/',              icon:'📊', label:'Dashboard',         section:'Visão Geral' },
  { to:'/mural',         icon:'📌', label:'Mural de Avisos',   section:'Comunicação' },
  { to:'/coordenadores', icon:'👤', label:'Coordenadores',     section:'Comunicação' },
  { to:'/diretores',     icon:'🏛️', label:'Diretores',         section:'Comunicação' },
  { to:'/atividades',    icon:'🗓️', label:'Planejamento',      section:'Atividades' },
  { to:'/registros',     icon:'📸', label:'Registros & Fotos', section:'Atividades' },
  { to:'/metricas',      icon:'📈', label:'Métricas',          section:'Atividades' },
  { to:'/participantes', icon:'👧', label:'Participantes',     section:'Cadastros' },
  { to:'/relatorios',    icon:'📄', label:'Relatórios',        section:'Cadastros' },
  { to:'/estoque',       icon:'📦', label:'Estoque',           section:'Gestão' },
  { to:'/materiais',     icon:'🛒', label:'Compras',           section:'Gestão' },
  { to:'/financeiro',    icon:'💰', label:'Contas',            section:'Financeiro' },
  { to:'/arrecadacao',   icon:'🎯', label:'Arrecadação',       section:'Financeiro' },
  { to:'/usuarios',      icon:'🔐', label:'Usuários',          section:'Admin', adminOnly:true },
  { to:'/auditoria',     icon:'🔍', label:'Auditoria',         section:'Admin', adminOnly:true },
]

export default function Layout() {
  const { user, perfil, nomeUser, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  async function handleLogout() {
    setShowUserMenu(false); setSidebarOpen(false)
    await supabase.auth.signOut()
    navigate('/login')
  }

  const initials = nomeUser.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  const sections = {}
  NAV.forEach(item => {
    if (item.adminOnly && !isAdmin) return
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  })

  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'var(--font-body)' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.52)', zIndex:199, backdropFilter:'blur(3px)' }} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside style={{
        width: 250,
        height: '100vh',
        background: 'linear-gradient(180deg,#0d1f42 0%,#1a3a6b 60%,#1e4578 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0, top: 0,
        zIndex: 200,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,.35)' : 'none',
        overflowY: 'hidden',
        overflowX: 'hidden',
      }}>

        {/* Logo */}
        <div style={{ padding:'18px 14px 14px', textAlign:'center', borderBottom:'1px solid rgba(201,162,39,.2)', flexShrink:0 }}>
          <img src="/logo.png" alt="Instituto Nossa Senhora Menina"
            style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(201,162,39,.5)', display:'block', margin:'0 auto 8px' }} />
          <div style={{ fontFamily:'var(--font-display)', color:'white', fontSize:13, fontWeight:700, lineHeight:1.4, marginBottom:3 }}>
            Instituto Nossa<br />Senhora Menina
          </div>
          <div style={{ fontSize:9, color:'var(--dourado-cl)', letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>
            Portal Administrativo
          </div>
        </div>

        {/* Nav — rolagem interna com scrollbar visível */}
        <nav style={{
          flex:1,
          padding:'10px 8px',
          overflowY:'auto',
          overflowX:'hidden',
          /* scrollbar visível para indicar que há mais itens */
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(201,162,39,.4) rgba(255,255,255,.05)',
        }}>
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div style={{ fontSize:9, color:'rgba(201,162,39,.6)', letterSpacing:2, textTransform:'uppercase', fontWeight:800, padding:'12px 10px 5px' }}>
                {section}
              </div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setSidebarOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8, marginBottom: 1,
                    color: isActive ? 'var(--dourado-cl)' : 'rgba(255,255,255,.72)',
                    background: isActive ? 'rgba(201,162,39,.18)' : 'transparent',
                    border: isActive ? '1px solid rgba(201,162,39,.28)' : '1px solid transparent',
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    textDecoration: 'none', transition: 'all .18s', fontFamily: 'var(--font-body)',
                  })}
                >
                  <span style={{ fontSize:15, width:19, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Usuário + Logout — sempre visível no rodapé */}
        <div style={{ padding:'12px 12px', borderTop:'1px solid rgba(255,255,255,.1)', flexShrink:0, background:'rgba(0,0,0,.15)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:32, height:32, background:'linear-gradient(135deg,var(--dourado),var(--dourado-cl))', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:11, color:'var(--azul)', flexShrink:0 }}>
              {initials}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:'white', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nomeUser}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.45)', textTransform:'capitalize' }}>{perfil?.perfil || 'leitura'}</div>
            </div>
          </div>
          {/* Botão de logout SEMPRE VISÍVEL */}
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'rgba(192,57,43,.9)',
              color: 'white', border: 'none', borderRadius: 9,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background .18s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#c0392b'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(192,57,43,.9)'}
          >
            <span style={{ fontSize:15 }}>⏏</span> Sair do Sistema
          </button>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div style={{ marginLeft:0, flex:1, display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        {/* Topbar */}
        <header style={{
          background: 'white', padding: '0 16px', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--borda)', position: 'sticky', top: 0, zIndex: 100,
          boxShadow: '0 2px 8px rgba(26,58,107,.06)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Menu"
              style={{ background:'none', border:'none', cursor:'pointer', padding:'8px 10px', color:'var(--azul)', fontSize:22, lineHeight:1, borderRadius:8, display:'flex', alignItems:'center', minWidth:42, minHeight:42, justifyContent:'center' }}
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
            <img src="/logo.png" alt="" style={{ width:30, height:30, borderRadius:'50%', objectFit:'cover', border:'1px solid var(--borda)' }} />
            <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--azul)', fontWeight:700 }}>
              Instituto NSM
            </span>
          </div>

          {/* Usuário na topbar com dropdown de logout */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ background:'var(--azul)', color:'white', fontSize:10, fontWeight:800, padding:'3px 9px', borderRadius:20 }}>✦ 2026</span>

            <div style={{ position:'relative' }}>
              <button
                onClick={() => setShowUserMenu(m => !m)}
                style={{ display:'flex', alignItems:'center', gap:7, background:'var(--cinza-cl)', border:'1px solid var(--borda)', borderRadius:9, padding:'5px 10px 5px 5px', cursor:'pointer', transition:'all .18s' }}
              >
                <div style={{ width:27, height:27, background:'linear-gradient(135deg,var(--dourado),var(--dourado-cl))', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:10, color:'var(--azul)', flexShrink:0 }}>
                  {initials}
                </div>
                <span style={{ fontSize:12.5, color:'var(--azul)', fontWeight:600, maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {nomeUser.split(' ')[0]}
                </span>
                <span style={{ fontSize:10, color:'var(--cinza)' }}>▾</span>
              </button>

              {showUserMenu && (
                <>
                  <div onClick={() => setShowUserMenu(false)} style={{ position:'fixed', inset:0, zIndex:299 }} />
                  <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, background:'white', border:'1px solid var(--borda)', borderRadius:12, boxShadow:'0 8px 28px rgba(26,58,107,.16)', minWidth:200, zIndex:300, overflow:'hidden' }}>
                    <div style={{ padding:'12px 14px', background:'var(--creme)', borderBottom:'1px solid var(--borda)' }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'var(--azul)' }}>{nomeUser}</div>
                      <div style={{ fontSize:11, color:'var(--cinza)', marginTop:1 }}>{user?.email}</div>
                      <div style={{ marginTop:5 }}>
                        <span style={{ fontSize:10, background:'var(--azul)', color:'white', padding:'2px 7px', borderRadius:20, fontWeight:700 }}>
                          {perfil?.perfil === 'admin' ? '⭐ Admin' : perfil?.perfil === 'coord' ? '✏️ Coordenador' : '👁️ Leitura'}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding:'5px' }}>
                      <button
                        onClick={handleLogout}
                        style={{ width:'100%', padding:'10px 12px', background:'none', border:'none', cursor:'pointer', borderRadius:7, display:'flex', alignItems:'center', gap:9, color:'var(--vermelho)', fontWeight:700, fontSize:13.5, fontFamily:'var(--font-body)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--vermelho-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <span style={{ fontSize:16 }}>⏏</span> Sair do Sistema
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Conteúdo — rola normalmente */}
        <main style={{ flex:1, padding:'22px 18px', width:'100%', maxWidth:1400, margin:'0 auto', boxSizing:'border-box' }}>
          <Outlet />
        </main>

        <footer style={{ padding:'12px 18px', background:'white', borderTop:'1px solid var(--borda)', textAlign:'center', fontSize:11, color:'var(--cinza)' }}>
          ✦ Instituto Nossa Senhora Menina · Portal Administrativo
        </footer>
      </div>
    </div>
  )
}
