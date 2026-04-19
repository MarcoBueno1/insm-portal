import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { gerarListaPresencaPDF, abrirGoogleCalendar, formatarData } from '../lib/pdf'

const TEMAS = ['Arte Sacra', 'Retiros Espirituais', 'Catequese', 'Terço & Oração', 'Formação Familiar', 'Missa das Crianças', 'Adoração', 'Formação de Catequistas', 'Outro']
const EMPTY = { titulo: '', data: '', hora_inicio: '', hora_fim: '', local: '', tema: TEMAS[0], descricao: '', qtd_criancas: '', qtd_adultos: '', insumos: '' }

export default function Atividades() {
  const { isCoord, user } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('atividades').select('*').order('data', { ascending: false })
    setLista(data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModalOpen(true) }
  function abrirEditar(a) {
    setForm({
      titulo: a.titulo, data: a.data, hora_inicio: a.hora_inicio || '', hora_fim: a.hora_fim || '',
      local: a.local || '', tema: a.tema || TEMAS[0], descricao: a.descricao || '',
      qtd_criancas: a.qtd_criancas || '', qtd_adultos: a.qtd_adultos || '', insumos: a.insumos || ''
    })
    setEditando(a.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.data) { toast('Título e data são obrigatórios.', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      qtd_criancas: parseInt(form.qtd_criancas) || 0,
      qtd_adultos: parseInt(form.qtd_adultos) || 0,
      criado_por: user?.id,
    }
    let error
    if (editando) {
      ({ error } = await supabase.from('atividades').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando))
    } else {
      ({ error } = await supabase.from('atividades').insert(payload))
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Atividade atualizada!' : 'Atividade criada!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function mudarStatus(id, status) {
    await supabase.from('atividades').update({ status, atualizado_em: new Date().toISOString() }).eq('id', id)
    toast(status === 'realizada' ? '✅ Atividade marcada como realizada!' : 'Status atualizado.')
    load()
  }

  async function remover(id) {
    if (!confirm('Excluir esta atividade? Esta ação não pode ser desfeita.')) return
    await supabase.from('atividades').delete().eq('id', id)
    toast('Atividade excluída.')
    setExpandido(null)
    load()
  }

  const filtradas = lista.filter(a => {
    const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus
    const matchBusca = !busca || a.titulo.toLowerCase().includes(busca.toLowerCase()) || (a.local || '').toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchBusca
  })

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🗓️ Planejamento de Atividades</h1>
          <p className="page-subtitle">Gerencie todas as atividades — integrado com Google Agenda</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={() => toast('Use o botão 📅 em cada atividade para adicionar ao Google Agenda.', 'info')}>
            📅 Google Agenda
          </button>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>+ Nova Atividade</button>}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tabs">
          {[['todos', 'Todas'], ['planejada', '📅 Planejadas'], ['realizada', '✅ Realizadas'], ['cancelada', '❌ Canceladas']].map(([val, lbl]) => (
            <button key={val} className={`tab ${filtroStatus === val ? 'active' : ''}`} onClick={() => setFiltroStatus(val)}>{lbl}</button>
          ))}
        </div>
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input placeholder="Buscar atividade ou local..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtradas.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🗓️</span>
          <h3>Nenhuma atividade encontrada</h3>
          <p>{busca || filtroStatus !== 'todos' ? 'Tente ajustar os filtros.' : 'Comece criando a primeira atividade!'}</p>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>Criar atividade</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtradas.map(a => (
            <div key={a.id} className="ativ-card">
              <div className="ativ-header" onClick={() => setExpandido(expandido === a.id ? null : a.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div className="ativ-title">{a.titulo}</div>
                    <span className={`badge badge-${a.status}`}>
                      {a.status === 'planejada' ? '📅' : a.status === 'realizada' ? '✅' : '❌'} {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                    </span>
                  </div>
                  <div className="ativ-meta">
                    <span>📅 {formatarData(a.data)}</span>
                    {a.local && <span>📍 {a.local}</span>}
                    <span>👧 {a.qtd_criancas || 0} crianças</span>
                    <span>👨 {a.qtd_adultos || 0} adultos</span>
                    {a.tema && <span>🎯 {a.tema}</span>}
                    {a.data < hoje && a.status === 'planejada' && (
                      <span style={{ color: 'var(--laranja)', fontWeight: '700' }}>⚠ Data passada</span>
                    )}
                  </div>
                </div>
                <span style={{ color: 'var(--cinza)', fontSize: '18px', transition: 'transform 0.2s', transform: expandido === a.id ? 'rotate(180deg)' : '' }}>▾</span>
              </div>

              {expandido === a.id && (
                <div className="ativ-body">
                  <div className="ativ-body-inner">
                    {a.descricao && (
                      <p style={{ fontSize: '13.5px', color: 'var(--cinza-medio)', marginBottom: '14px', lineHeight: '1.6' }}>{a.descricao}</p>
                    )}
                    {a.insumos && (
                      <div style={{ background: 'var(--creme)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
                        <strong style={{ fontSize: '11.5px', color: 'var(--azul)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Insumos Necessários</strong>
                        <p style={{ fontSize: '13px', color: 'var(--cinza-medio)', marginTop: '6px' }}>{a.insumos}</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => gerarListaPresencaPDF(a)}>
                        🖨️ Lista de Presença
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => abrirGoogleCalendar(a)}>
                        📅 Adicionar ao Google Agenda
                      </button>
                      {a.status === 'planejada' && isCoord && (
                        <button className="btn btn-sm btn-success" onClick={() => mudarStatus(a.id, 'realizada')}>
                          ✅ Marcar como Realizada
                        </button>
                      )}
                      {a.status === 'planejada' && isCoord && (
                        <button className="btn btn-sm btn-ghost" onClick={() => mudarStatus(a.id, 'cancelada')} style={{ color: 'var(--vermelho)' }}>
                          ❌ Cancelar
                        </button>
                      )}
                      {isCoord && (
                        <>
                          <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(a)}>✏️ Editar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => remover(a.id)}>🗑 Excluir</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Atividade' : '🗓️ Nova Atividade'} size="lg"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : editando ? 'Salvar Alterações' : 'Criar Atividade'}
          </button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Título da Atividade *</label>
          <input className="form-input" placeholder="Ex: Retiro Infantil de Nossa Senhora"
            value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Data *</label>
            <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Local</label>
            <input className="form-input" placeholder="Ex: Salão Principal" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Horário Início</label>
            <input className="form-input" type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Horário Fim</label>
            <input className="form-input" type="time" value={form.hora_fim} onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Nº de Crianças</label>
            <input className="form-input" type="number" min="0" placeholder="0"
              value={form.qtd_criancas} onChange={e => setForm(f => ({ ...f, qtd_criancas: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Nº de Adultos</label>
            <input className="form-input" type="number" min="0" placeholder="0"
              value={form.qtd_adultos} onChange={e => setForm(f => ({ ...f, qtd_adultos: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tema</label>
          <select className="form-select" value={form.tema} onChange={e => setForm(f => ({ ...f, tema: e.target.value }))}>
            {TEMAS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea className="form-textarea" rows="2" placeholder="Descreva os objetivos da atividade..."
            value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Insumos Necessários</label>
          <textarea className="form-textarea" rows="3" placeholder="Ex: 50 folhas sulfite, 30 lápis de cor, tinta guache..."
            value={form.insumos} onChange={e => setForm(f => ({ ...f, insumos: e.target.value }))} />
        </div>
        <div className="alert alert-blue">
          <span className="alert-icon">📅</span>
          <div style={{ fontSize: '12.5px' }}>
            Após criar, clique em <strong>"Adicionar ao Google Agenda"</strong> na atividade para sincronizá-la com a agenda dos coordenadores.
          </div>
        </div>
      </Modal>
    </div>
  )
}
