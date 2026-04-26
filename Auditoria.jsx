import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useNavigate } from 'react-router-dom'

const ACOES = ['todas', 'criar', 'editar', 'remover', 'login']
const TABELAS = ['todas', 'mural', 'atividades', 'estoque', 'compras', 'coordenadores', 'usuarios_aprovados', 'financeiro']

const ACAO_COR = {
  criar:   { bg: 'var(--verde-bg)',    color: 'var(--verde)',   label: '✅ Criar' },
  editar:  { bg: 'var(--dourado-bg)', color: 'var(--dourado)', label: '✏️ Editar' },
  remover: { bg: 'var(--vermelho-bg)',color: 'var(--vermelho)', label: '🗑 Remover' },
  login:   { bg: 'var(--azul-suave)', color: 'var(--azul)',    label: '🔐 Login' },
}

export default function Auditoria() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroAcao, setFiltroAcao] = useState('todas')
  const [filtroTabela, setFiltroTabela] = useState('todas')
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState(null)
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    loadLogs()
  }, [isAdmin])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('auditoria')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(500)
    setLogs(data || [])
    setLoading(false)
  }

  const filtrados = logs.filter(l => {
    if (filtroAcao !== 'todas' && l.acao !== filtroAcao) return false
    if (filtroTabela !== 'todas' && l.tabela !== filtroTabela) return false
    if (busca && !l.descricao?.toLowerCase().includes(busca.toLowerCase()) &&
        !l.usuario_nome?.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  const paginados = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPag = Math.ceil(filtrados.length / POR_PAGINA)

  function formatarData(dt) {
    if (!dt) return '-'
    const d = new Date(dt)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function renderDiff(anterior, novo) {
    try {
      const ant = anterior ? JSON.parse(anterior) : null
      const nov = novo ? JSON.parse(novo) : null
      if (!ant && !nov) return null

      const chaves = new Set([...Object.keys(ant || {}), ...Object.keys(nov || {})])
      const diffs = []
      chaves.forEach(k => {
        const va = ant?.[k]
        const vn = nov?.[k]
        if (JSON.stringify(va) !== JSON.stringify(vn)) {
          diffs.push({ k, va, vn })
        }
      })

      if (diffs.length === 0) return <span style={{ color: 'var(--cinza)', fontSize: 12 }}>Sem diferenças detectadas</span>

      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--cinza-cl)' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--azul)', fontWeight: 700 }}>Campo</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--vermelho)', fontWeight: 700 }}>Valor Anterior</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--verde)', fontWeight: 700 }}>Valor Novo</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--borda)', background: i % 2 === 0 ? 'white' : 'var(--creme)' }}>
                <td style={{ padding: '5px 10px', fontWeight: 700, color: 'var(--texto)' }}>{d.k}</td>
                <td style={{ padding: '5px 10px', color: 'var(--vermelho)' }}>
                  {d.va === undefined ? <em style={{ color: 'var(--cinza)' }}>—</em> : String(d.va)}
                </td>
                <td style={{ padding: '5px 10px', color: 'var(--verde)' }}>
                  {d.vn === undefined ? <em style={{ color: 'var(--cinza)' }}>—</em> : String(d.vn)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    } catch {
      return <span style={{ color: 'var(--cinza)', fontSize: 12 }}>Dados não estruturados</span>
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🔍 Auditoria do Sistema</h1>
          <p className="page-subtitle">Histórico completo de todas as alterações — quem mudou o quê e quando</p>
        </div>
        <button className="btn btn-ghost" onClick={loadLogs}>🔄 Atualizar</button>
      </div>

      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Total de Eventos', val: logs.length, icon: '📋', color: 'var(--azul)' },
          { label: 'Criações', val: logs.filter(l => l.acao === 'criar').length, icon: '✅', color: 'var(--verde)' },
          { label: 'Edições', val: logs.filter(l => l.acao === 'editar').length, icon: '✏️', color: 'var(--dourado)' },
          { label: 'Remoções', val: logs.filter(l => l.acao === 'remover').length, icon: '🗑', color: 'var(--vermelho)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{s.val}</div>
            <div style={{ fontSize: 11, color: 'var(--cinza)', fontWeight: 700, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="🔍 Buscar por descrição ou usuário..."
          value={busca} onChange={e => { setBusca(e.target.value); setPagina(0) }} />
        <select className="form-select" style={{ width: 'auto' }} value={filtroAcao} onChange={e => { setFiltroAcao(e.target.value); setPagina(0) }}>
          {ACOES.map(a => <option key={a} value={a}>{a === 'todas' ? 'Todas as ações' : ACAO_COR[a]?.label || a}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filtroTabela} onChange={e => { setFiltroTabela(e.target.value); setPagina(0) }}>
          {TABELAS.map(t => <option key={t} value={t}>{t === 'todas' ? 'Todas as tabelas' : t}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--cinza)', whiteSpace: 'nowrap' }}>{filtrados.length} evento(s)</span>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🔍</span>
          <h3>Nenhum evento encontrado</h3>
          <p>Ajuste os filtros para ver os registros de auditoria.</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--azul)', color: 'white' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700 }}>Data/Hora</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700 }}>Usuário</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700 }}>Ação</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700 }}>Tabela</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700 }}>Descrição</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, fontWeight: 700 }}>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {paginados.map((log, i) => {
                  const cor = ACAO_COR[log.acao] || { bg: 'var(--cinza-cl)', color: 'var(--cinza)', label: log.acao }
                  const isExp = expandido === log.id
                  return (
                    <React.Fragment key={log.id}>
                      <tr style={{ borderBottom: '1px solid var(--borda)', background: i % 2 === 0 ? 'white' : 'var(--creme)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--azul-suave)'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : 'var(--creme)'}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--cinza-medio)', whiteSpace: 'nowrap' }}>
                          {formatarData(log.criado_em)}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--azul)' }}>
                          {log.usuario_nome || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: cor.bg, color: cor.color, padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                            {cor.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12 }}>
                          <code style={{ background: 'var(--cinza-cl)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                            {log.tabela}
                          </code>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 13, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.descricao}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {(log.valor_anterior || log.valor_novo) && (
                            <button className="btn btn-sm btn-ghost"
                              onClick={() => setExpandido(isExp ? null : log.id)}
                              style={{ fontSize: 11, padding: '4px 10px' }}>
                              {isExp ? '▲ Fechar' : '▼ Ver diff'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExp && (
                        <tr>
                          <td colSpan={6} style={{ padding: '12px 18px', background: 'var(--dourado-bg)', borderBottom: '2px solid var(--dourado)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--azul)', marginBottom: 8, fontSize: 13 }}>
                              📊 Comparação de valores — {log.descricao}
                            </div>
                            {renderDiff(log.valor_anterior, log.valor_novo)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPag > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}>← Anterior</button>
              <span style={{ fontSize: 13, color: 'var(--cinza-medio)' }}>Página {pagina + 1} de {totalPag}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPagina(p => Math.min(totalPag - 1, p + 1))} disabled={pagina >= totalPag - 1}>Próxima →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
