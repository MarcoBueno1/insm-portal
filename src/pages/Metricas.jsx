import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CORES = [
  'linear-gradient(90deg,#1a3a6b,#4a7fcb)',
  'linear-gradient(90deg,#c9a227,#e8c547)',
  'linear-gradient(90deg,#2e7d52,#52c27d)',
  'linear-gradient(90deg,#7b2fa0,#c29ee0)',
  'linear-gradient(90deg,#d4680a,#f0a940)',
  'linear-gradient(90deg,#c0392b,#e74c3c)',
]

function BarChart({ dados, max, cor }) {
  return (
    <div className="bar-chart">
      {dados.map(([label, valor], i) => (
        <div key={label} className="bar-row">
          <div className="bar-label">
            <span>{label}</span>
            <span>{typeof valor === 'number' && valor % 1 === 0 ? valor.toLocaleString('pt-BR') : valor}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: max > 0 ? `${(valor/max)*100}%` : '0%', background: cor || CORES[i % CORES.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function BarDupla({ dados }) {
  // dados: [{ label, estimado, real }]
  const maxVal = Math.max(...dados.flatMap(d => [d.estimado, d.real]), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {dados.map(d => (
        <div key={d.label}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--texto)', marginBottom: 5 }}>{d.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--cinza-medio)', width: 66, textAlign: 'right', flexShrink: 0 }}>📋 Est. {d.estimado}</span>
              <div style={{ flex: 1, background: 'var(--cinza-cl)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 100, width: `${(d.estimado/maxVal)*100}%`, background: 'linear-gradient(90deg,var(--azul),var(--azul-claro))', transition: 'width 1s ease' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--verde)', width: 66, textAlign: 'right', flexShrink: 0 }}>✅ Real {d.real}</span>
              <div style={{ flex: 1, background: 'var(--cinza-cl)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 100, width: `${(d.real/maxVal)*100}%`, background: 'linear-gradient(90deg,var(--verde),#52c27d)', transition: 'width 1s ease' }} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Metricas() {
  const [atividades, setAtividades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('atividades').select('*').eq('status', 'realizada').order('data')
    setAtividades(data || [])
    setLoading(false)
  }

  // Totais estimados
  const totalCriancasEst = atividades.reduce((s, a) => s + (a.qtd_criancas || 0), 0)
  const totalAdultosEst  = atividades.reduce((s, a) => s + (a.qtd_adultos  || 0), 0)
  // Totais reais (apenas atividades com dados reais)
  const comDadosReais = atividades.filter(a => a.real_criancas != null || a.real_adultos != null)
  const totalCriancasReal = comDadosReais.reduce((s, a) => s + (a.real_criancas || 0), 0)
  const totalAdultosReal  = comDadosReais.reduce((s, a) => s + (a.real_adultos  || 0), 0)
  const totalAts = atividades.length

  // Por tema (estimado)
  const porTema = {}
  atividades.forEach(a => { const t = a.tema || 'Outros'; porTema[t] = (porTema[t]||0) + (a.qtd_criancas||0) })
  const temaEntries = Object.entries(porTema).sort((a, b) => b[1]-a[1])
  const maxTema = temaEntries[0]?.[1] || 1

  // Por mês (estimado)
  const porMes = {}
  atividades.forEach(a => {
    if (!a.data) return
    const d = new Date(a.data+'T12:00')
    const key = d.toLocaleString('pt-BR', { month:'short', year:'2-digit' })
    porMes[key] = (porMes[key]||0) + (a.qtd_criancas||0)
  })
  const mesEntries = Object.entries(porMes).slice(-8)
  const maxMes = mesEntries.reduce((m,[,v])=>Math.max(m,v),1)

  // Estimado vs Real por atividade (últimas 6)
  const compAtividades = atividades
    .filter(a => a.real_criancas != null || a.real_adultos != null)
    .slice(-6)
    .map(a => ({
      label: a.titulo.length > 22 ? a.titulo.slice(0,22)+'…' : a.titulo,
      estimado: (a.qtd_criancas||0) + (a.qtd_adultos||0),
      real: (a.real_criancas||0) + (a.real_adultos||0),
    }))

  // Adultos estimado vs real por atividade
  const compAdultos = atividades
    .filter(a => a.real_adultos != null)
    .slice(-6)
    .map(a => ({
      label: a.titulo.length > 22 ? a.titulo.slice(0,22)+'…' : a.titulo,
      estimado: a.qtd_adultos || 0,
      real: a.real_adultos || 0,
    }))

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Métricas & Impacto Social</h1>
          <p className="page-subtitle">Acompanhe o alcance e impacto real das atividades</p>
        </div>
      </div>

      {/* ── Stats principais ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        <div className="stat-card blue">
          <span className="stat-icon">👧</span>
          <div className="stat-value">{totalCriancasEst.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Crianças Estimadas</div>
          {comDadosReais.length > 0 && <div className="stat-trend">✅ Real: {totalCriancasReal.toLocaleString('pt-BR')}</div>}
        </div>
        <div className="stat-card gold">
          <span className="stat-icon">👨‍👩‍👧</span>
          <div className="stat-value">{totalAdultosEst.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Adultos Estimados</div>
          {comDadosReais.length > 0 && <div className="stat-trend">✅ Real: {totalAdultosReal.toLocaleString('pt-BR')}</div>}
        </div>
        <div className="stat-card green">
          <span className="stat-icon">🗓️</span>
          <div className="stat-value">{totalAts}</div>
          <div className="stat-label">Atividades Realizadas</div>
          <div className="stat-trend">{comDadosReais.length} com presença registrada</div>
        </div>
        <div className="stat-card orange">
          <span className="stat-icon">🎯</span>
          <div className="stat-value">{Object.keys(porTema).length}</div>
          <div className="stat-label">Temas Trabalhados</div>
        </div>
      </div>

      {atividades.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📈</span>
          <h3>Sem dados ainda</h3>
          <p>As métricas aparecem após registrar atividades realizadas.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:22 }}>

          {/* Crianças por mês */}
          <div className="panel">
            <div className="panel-header"><h2 className="card-title">📅 Crianças por Mês (estimado)</h2></div>
            <div className="panel-body">
              {mesEntries.length === 0
                ? <p style={{ color:'var(--cinza)', fontSize:13 }}>Sem dados.</p>
                : <BarChart dados={mesEntries} max={maxMes} cor={CORES[0]} />}
            </div>
          </div>

          {/* Por tema */}
          <div className="panel">
            <div className="panel-header"><h2 className="card-title">🎯 Crianças por Tema</h2></div>
            <div className="panel-body">
              {temaEntries.length === 0
                ? <p style={{ color:'var(--cinza)', fontSize:13 }}>Sem dados.</p>
                : <BarChart dados={temaEntries} max={maxTema} />}
            </div>
          </div>

          {/* Estimado vs Real — total */}
          {compAtividades.length > 0 && (
            <div className="panel">
              <div className="panel-header"><h2 className="card-title">📊 Estimado vs Real — Total Participantes</h2></div>
              <div className="panel-body">
                <div className="alert alert-blue" style={{ marginBottom:14 }}>
                  <span className="alert-icon">ℹ️</span>
                  <div style={{ fontSize:12 }}>Apenas atividades com presença real registrada são exibidas aqui.</div>
                </div>
                <BarDupla dados={compAtividades} />
              </div>
            </div>
          )}

          {/* Estimado vs Real — adultos */}
          {compAdultos.length > 0 && (
            <div className="panel">
              <div className="panel-header"><h2 className="card-title">👨 Estimado vs Real — Adultos</h2></div>
              <div className="panel-body">
                <BarDupla dados={compAdultos} />
              </div>
            </div>
          )}

          {/* Tabela histórico */}
          <div className="panel" style={{ gridColumn: compAtividades.length > 0 ? '1 / -1' : undefined }}>
            <div className="panel-header"><h2 className="card-title">✅ Histórico Completo</h2></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Data</th>
                    <th style={{ textAlign:'center' }}>👧 Est.</th>
                    <th style={{ textAlign:'center' }}>👧 Real</th>
                    <th style={{ textAlign:'center' }}>👨 Est.</th>
                    <th style={{ textAlign:'center' }}>👨 Real</th>
                    <th style={{ textAlign:'center' }}>Aderência</th>
                  </tr>
                </thead>
                <tbody>
                  {[...atividades].reverse().map(a => {
                    const totalEst = (a.qtd_criancas||0) + (a.qtd_adultos||0)
                    const totalReal = (a.real_criancas != null || a.real_adultos != null) ? (a.real_criancas||0) + (a.real_adultos||0) : null
                    const pct = totalReal != null && totalEst > 0 ? Math.round((totalReal/totalEst)*100) : null
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.titulo}</strong>
                          <br/><span style={{ fontSize:11, color:'var(--cinza)' }}>{a.tema||'—'}</span>
                        </td>
                        <td style={{ whiteSpace:'nowrap', fontSize:12 }}>
                          {a.data ? new Date(a.data+'T12:00').toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td style={{ textAlign:'center', fontWeight:700 }}>{a.qtd_criancas||0}</td>
                        <td style={{ textAlign:'center', fontWeight:700, color: a.real_criancas != null ? 'var(--verde)' : 'var(--cinza)' }}>
                          {a.real_criancas != null ? a.real_criancas : <span style={{ fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ textAlign:'center', fontWeight:700 }}>{a.qtd_adultos||0}</td>
                        <td style={{ textAlign:'center', fontWeight:700, color: a.real_adultos != null ? 'var(--verde)' : 'var(--cinza)' }}>
                          {a.real_adultos != null ? a.real_adultos : <span style={{ fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          {pct != null ? (
                            <span style={{ fontSize:12, fontWeight:800, padding:'3px 9px', borderRadius:20,
                              background: pct >= 90 ? 'var(--verde-bg)' : pct >= 70 ? 'var(--dourado-bg)' : 'var(--vermelho-bg)',
                              color: pct >= 90 ? 'var(--verde)' : pct >= 70 ? '#7a5a00' : 'var(--vermelho)' }}>
                              {pct}%
                            </span>
                          ) : (
                            <span style={{ fontSize:11, color:'var(--cinza)' }}>⏳ Pendente</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
