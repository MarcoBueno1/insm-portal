import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { formatarData } from '../lib/pdf'

export default function Dashboard() {
  const { nomeUser } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ criancas: 0, atividades: 0, estoque: 0, mural: 0 })
  const [proximasAtividades, setProximasAtividades] = useState([])
  const [alertasEstoque, setAlertasEstoque] = useState([])
  const [muralRecente, setMuralRecente] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [atRes, esRes, muRes] = await Promise.all([
        supabase.from('atividades').select('id, titulo, data, local, qtd_criancas, qtd_adultos, tema, status').order('data', { ascending: true }),
        supabase.from('estoque').select('*'),
        supabase.from('mural').select('*').eq('ativo', true).order('criado_em', { ascending: false }).limit(4),
      ])

      const atividades = atRes.data || []
      const estoque = esRes.data || []
      const mural = muRes.data || []

      const hoje = new Date().toISOString().slice(0, 10)
      const realizadas = atividades.filter(a => a.status === 'realizada')
      const proximas = atividades.filter(a => a.status === 'planejada' && a.data >= hoje)
        .sort((a, b) => a.data.localeCompare(b.data)).slice(0, 4)

      const totalCriancas = realizadas.reduce((s, a) => s + (a.qtd_criancas || 0), 0)
      const alertas = estoque.filter(e => e.qtd_atual <= e.qtd_minima || e.qtd_atual <= 0)

      setStats({
        criancas: totalCriancas,
        atividades: realizadas.length,
        estoque: estoque.length,
        mural: mural.length,
      })
      setProximasAtividades(proximas)
      setAlertasEstoque(alertas.slice(0, 3))
      setMuralRecente(mural.slice(0, 3))
    } finally { setLoading(false) }
  }

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const statusColor = {
    planejada: { bg: 'var(--azul-suave)', color: 'var(--azul-medio)' },
    realizada: { bg: 'var(--verde-bg)', color: 'var(--verde)' },
    cancelada: { bg: 'var(--vermelho-bg)', color: 'var(--vermelho)' },
  }

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      <span>Carregando dashboard...</span>
    </div>
  )

  return (
    <div className="animate-in">
      {/* Saudação */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '13px', color: 'var(--cinza-medio)', marginBottom: '4px' }}>
          {saudacao}, <strong>{nomeUser.split(' ')[0]}</strong> ✦
        </div>
        <h1 className="page-title">Dashboard Geral</h1>
        <div className="page-subtitle">Resumo do Instituto Nossa Senhora Menina</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '28px' }}>
        <div className="stat-card blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/metricas')}>
          <span className="stat-icon">👧</span>
          <div className="stat-value">{stats.criancas.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Crianças Atendidas</div>
          <div className="stat-trend">↑ Atividades realizadas</div>
        </div>
        <div className="stat-card gold" style={{ cursor: 'pointer' }} onClick={() => navigate('/atividades')}>
          <span className="stat-icon">🗓️</span>
          <div className="stat-value">{stats.atividades}</div>
          <div className="stat-label">Atividades Realizadas</div>
          <div className="stat-trend">Ver planejamento →</div>
        </div>
        <div className="stat-card green" style={{ cursor: 'pointer' }} onClick={() => navigate('/estoque')}>
          <span className="stat-icon">📦</span>
          <div className="stat-value">{stats.estoque}</div>
          <div className="stat-label">Itens no Estoque</div>
          {alertasEstoque.length > 0 && (
            <div className="stat-trend" style={{ color: 'var(--laranja)' }}>⚠ {alertasEstoque.length} itens precisam de atenção</div>
          )}
        </div>
        <div className="stat-card orange" style={{ cursor: 'pointer' }} onClick={() => navigate('/mural')}>
          <span className="stat-icon">📌</span>
          <div className="stat-value">{stats.mural}</div>
          <div className="stat-label">Avisos no Mural</div>
          <div className="stat-trend">Ver todos os avisos →</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px', marginBottom: '22px' }}>
        {/* Próximas atividades */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📅 Próximas Atividades</span>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/atividades')}>Ver todas</button>
          </div>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            {proximasAtividades.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 16px' }}>
                <span className="empty-icon" style={{ fontSize: '32px' }}>🗓️</span>
                <p>Nenhuma atividade planejada</p>
                <button className="btn btn-sm btn-primary" onClick={() => navigate('/atividades')}>Planejar atividade</button>
              </div>
            ) : proximasAtividades.map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 14px', borderRadius: '10px',
                background: 'var(--creme)', marginBottom: '8px',
                borderLeft: '3px solid var(--azul-claro)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--azul-suave)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--creme)'}
                onClick={() => navigate('/atividades')}
              >
                <div style={{ textAlign: 'center', minWidth: '44px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: 'var(--azul)', lineHeight: '1' }}>
                    {new Date(a.data + 'T12:00').getDate().toString().padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--cinza)', textTransform: 'uppercase', fontWeight: '700' }}>
                    {new Date(a.data + 'T12:00').toLocaleString('pt-BR', { month: 'short' })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--azul)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--cinza-medio)', marginTop: '2px' }}>
                    📍 {a.local || '—'} · 👧 {a.qtd_criancas || 0} crianças
                  </div>
                </div>
                <span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mural recente */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📌 Avisos Recentes</span>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/mural')}>Ver mural</button>
          </div>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            {muralRecente.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 16px' }}>
                <span className="empty-icon" style={{ fontSize: '32px' }}>📌</span>
                <p>Nenhum aviso publicado</p>
              </div>
            ) : muralRecente.map(a => (
              <div key={a.id} className={`mural-card ${a.tipo}`} style={{ marginBottom: '10px', padding: '14px 16px' }}
                onClick={() => navigate('/mural')} style={{ cursor: 'pointer', marginBottom: '10px' }}>
                <span className={`badge badge-${a.tipo}`} style={{ marginBottom: '6px', display: 'inline-flex' }}>
                  {a.tipo === 'aviso' ? '📢' : a.tipo === 'urgente' ? '🔴' : a.tipo === 'info' ? 'ℹ️' : '🌟'} {a.tipo}
                </span>
                <h3 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--azul)', marginTop: '4px' }}>{a.titulo}</h3>
                <p style={{ fontSize: '12px', color: 'var(--cinza-medio)', marginTop: '4px', lineHeight: '1.5',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {a.conteudo}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas estoque */}
      {alertasEstoque.length > 0 && (
        <div className="alert alert-red" style={{ cursor: 'pointer' }} onClick={() => navigate('/estoque')}>
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Atenção ao estoque!</strong> Itens com quantidade crítica ou abaixo do mínimo:&nbsp;
            {alertasEstoque.map(e => e.produto).join(', ')}.
            <span style={{ fontWeight: '700', marginLeft: '8px' }}>→ Ver estoque</span>
          </div>
        </div>
      )}
    </div>
  )
}
