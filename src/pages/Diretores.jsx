import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import SelectCadastravel from '../components/SelectCadastravel'

export default function Diretores() {
  const { isAdmin, isCoord } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)
  const EMPTY = { nome: '', area: '', descricao: '', whatsapp: '', email: '', ordem: 0 }
  const [form, setForm] = useState(EMPTY)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('diretores').select('*').eq('ativo', true).order('ordem').order('nome')
    setLista(data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModalOpen(true) }
  function abrirEditar(d) {
    setForm({ nome: d.nome, area: d.area, descricao: d.descricao || '', whatsapp: d.whatsapp || '', email: d.email || '', ordem: d.ordem || 0 })
    setEditando(d.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.area.trim()) { toast('Nome e área são obrigatórios.', 'error'); return }
    setSaving(true)
    let error
    if (editando) {
      ({ error } = await supabase.from('diretores').update(form).eq('id', editando))
    } else {
      ({ error } = await supabase.from('diretores').insert(form))
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Diretor atualizado!' : 'Diretor cadastrado!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function remover(id) {
    if (!confirm('Remover este diretor?')) return
    await supabase.from('diretores').update({ ativo: false }).eq('id', id)
    toast('Diretor removido.')
    load()
  }

  const filtrados = lista.filter(d =>
    !busca || d.nome.toLowerCase().includes(busca.toLowerCase()) || d.area.toLowerCase().includes(busca.toLowerCase())
  )

  const iniciais = nome => nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏛️ Diretores</h1>
          <p className="page-subtitle">Equipe diretiva do Instituto Nossa Senhora Menina</p>
        </div>
        <div className="page-actions">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar por nome ou área..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          {(isAdmin || isCoord) && <button className="btn btn-gold" onClick={abrirNovo}>+ Adicionar Diretor</button>}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏛️</span>
          <h3>{busca ? 'Nenhum resultado' : 'Nenhum diretor cadastrado'}</h3>
          <p>{busca ? 'Tente outro termo.' : 'Cadastre o primeiro diretor do Instituto.'}</p>
          {(isAdmin || isCoord) && <button className="btn btn-gold" onClick={abrirNovo}>Cadastrar diretor</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {filtrados.map(d => (
            <div key={d.id} className="coord-card">
              {/* Avatar com tom mais escuro para diretores */}
              <div className="coord-avatar" style={{ background: 'linear-gradient(135deg, #0d2347, #1a3a6b)', borderColor: '#c9a227' }}>
                {d.foto_url ? <img src={d.foto_url} alt={d.nome} /> : iniciais(d.nome)}
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--azul)', marginBottom: 3 }}>
                {d.nome}
              </h3>
              {/* Badge diretor */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ background: 'linear-gradient(135deg,#0d2347,#1a3a6b)', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20, letterSpacing: .5 }}>
                  🏛️ DIRETOR
                </span>
              </div>
              <div className="coord-area">{d.area}</div>
              <p className="coord-desc">{d.descricao || 'Diretor do Instituto Nossa Senhora Menina.'}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {d.whatsapp && (
                  <a href={`https://wa.me/55${d.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="btn btn-sm btn-whatsapp">💬 WhatsApp</a>
                )}
                {d.email && (
                  <a href={`mailto:${d.email}`} className="btn btn-sm btn-ghost">✉️ E-mail</a>
                )}
              </div>
              {(isAdmin || isCoord) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(d)}>✏️ Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remover(d.id)}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Diretor' : '🏛️ Novo Diretor'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar Diretor'}
          </button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Nome Completo *</label>
          <input className="form-input" placeholder="Ex: Dr. João Silva" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Área de Atuação *</label>
          <SelectCadastravel categoria="areas_diretor" value={form.area} onChange={v => setForm(f => ({ ...f, area: v }))} placeholder="Selecione a área..." />
        </div>
        <div className="form-group">
          <label className="form-label">Descrição do Papel</label>
          <textarea className="form-textarea" rows="3" placeholder="Descreva as responsabilidades deste diretor..."
            value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">WhatsApp (com DDD)</label>
            <input className="form-input" placeholder="11999887766" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="diretor@insm.org.br" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Ordem de Exibição</label>
          <input className="form-input" type="number" min="0" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} />
        </div>
      </Modal>
    </div>
  )
}
