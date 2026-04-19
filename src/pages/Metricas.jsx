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
            <span>{typeof valor === 'number' && valor % 1 === 0 ? valor : valor}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: max > 0 ? `${(valor / max) * 100}%` : '0%', background: cor || CORES[i % CORES.length] }} />
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

  const totalCriancas = atividades.reduce((s, a) => s + (a.qtd_criancas || 0), 0)
  const totalAdultos  = atividades.reduce((s, a) => s + (a.qtd_adultos || 0), 0)
  const totalAts      = atividades.length

  // Por tema
  const porTema = {}
  atividades.forEach(a => {
    const t = a.tema || 'Outros'
    porTema[t] = (porTema[t] || 0) + (a.qtd_criancas || 0)
  })
  const temaEntries = Object.entries(porTema).sort((a, b) => b[1] - a[1])
  const maxTema = temaEntries[0]?.[1] || 1

  // Por mês
  const porMes = {}
  atividades.forEach(a => {
    if (!a.data) return
    const d = new Date(a.data + 'T12:00')
    const key = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
    porMes[key] = (porMes[key] || 0) + (a.qtd_criancas || 0)
  })
  const mesEntries = Object.entries(porMes).slice(-8)
  const maxMes = mesEntries.reduce((m, [, v]) => Math.max(m, v), 1)

  // Nº de atividades por tema
  const atsPorTema = {}
  atividades.forEach(a => { const t = a.tema || 'Outros'; atsPorTema[t] = (atsPorTema[t] || 0) + 1 })
  const atsTemaEntries = Object.entries(atsPorTema).sort((a, b) => b[1] - a[1])
  const maxAts = atsTemaEntries[0]?.[1] || 1

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Métricas & Impacto Social</h1>
          <p className="page-subtitle">Acompanhe o alcance e impacto das atividades do Instituto</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginBottom: '28px' }}>
        <div className="stat-card blue">
          <span className="stat-icon">👧</span>
          <div className="stat-value">{totalCriancas.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Crianças Impactadas</div>
        </div>
        <div className="stat-card gold">
          <span className="stat-icon">👨‍👩‍👧</span>
          <div className="stat-value">{totalAdultos.toLocaleString('pt-BR')}</div>
          <div className="stat-label">Adultos Atendidos</div>
        </div>
        <div className="stat-card green">
          <span className="stat-icon">🗓️</span>
          <div className="stat-value">{totalAts}</div>
          <div className="stat-label">Atividades Realizadas</div>
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
          <p>As métricas aparecerão aqui após registrar atividades realizadas.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>
          {/* Por mês */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📅 Crianças por Mês</span>
            </div>
            <div className="card-body">
              {mesEntries.length === 0
                ? <p style={{ color: 'var(--cinza)', fontSize: '13px' }}>Nenhum dado disponível.</p>
                : <BarChart dados={mesEntries} max={maxMes} cor={CORES[0]} />}
            </div>
          </div>

          {/* Por tema - crianças */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">🎯 Crianças por Tema</span>
            </div>
            <div className="card-body">
              {temaEntries.length === 0
                ? <p style={{ color: 'var(--cinza)', fontSize: '13px' }}>Nenhum dado disponível.</p>
                : <BarChart dados={temaEntries} max={maxTema} />}
            </div>
          </div>

          {/* Nº atividades por tema */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">📊 Nº de Atividades por Tema</span>
            </div>
            <div className="card-body">
              {atsTemaEntries.length === 0
                ? <p style={{ color: 'var(--cinza)', fontSize: '13px' }}>Nenhum dado disponível.</p>
                : <BarChart dados={atsTemaEntries} max={maxAts} cor={CORES[1]} />}
            </div>
          </div>

          {/* Lista de atividades realizadas */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">✅ Histórico de Atividades</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Data</th>
                    <th>👧</th>
                    <th>👨</th>
                  </tr>
                </thead>
                <tbody>
                  {[...atividades].reverse().map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.titulo}</strong><br /><span style={{ fontSize: '11px', color: 'var(--cinza)' }}>{a.tema || '—'}</span></td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{a.data ? new Date(a.data + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{a.qtd_criancas || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: '700' }}>{a.qtd_adultos || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
