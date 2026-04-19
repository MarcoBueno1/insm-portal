import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'

export default function Coordenadores() {
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
    const { data } = await supabase.from('coordenadores').select('*').eq('ativo', true).order('ordem').order('nome')
    setLista(data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModalOpen(true) }
  function abrirEditar(c) { setForm({ nome: c.nome, area: c.area, descricao: c.descricao || '', whatsapp: c.whatsapp || '', email: c.email || '', ordem: c.ordem || 0 }); setEditando(c.id); setModalOpen(true) }

  async function salvar() {
    if (!form.nome.trim() || !form.area.trim()) { toast('Nome e área são obrigatórios.', 'error'); return }
    setSaving(true)
    if (editando) {
      const { error } = await supabase.from('coordenadores').update(form).eq('id', editando)
      if (error) toast('Erro: ' + error.message, 'error')
      else { toast('Coordenador atualizado!'); setModalOpen(false); load() }
    } else {
      const { error } = await supabase.from('coordenadores').insert(form)
      if (error) toast('Erro: ' + error.message, 'error')
      else { toast('Coordenador cadastrado!'); setModalOpen(false); load() }
    }
    setSaving(false)
  }

  async function remover(id) {
    if (!confirm('Remover este coordenador?')) return
    await supabase.from('coordenadores').update({ ativo: false }).eq('id', id)
    toast('Coordenador removido.')
    load()
  }

  const filtrados = lista.filter(c =>
    !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.area.toLowerCase().includes(busca.toLowerCase())
  )

  const iniciais = (nome) => nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Coordenadores</h1>
          <p className="page-subtitle">Encontre o responsável por cada área do Instituto</p>
        </div>
        <div className="page-actions">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar por nome ou área..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          {isAdmin && <button className="btn btn-gold" onClick={abrirNovo}>+ Adicionar</button>}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <h3>Nenhum coordenador encontrado</h3>
          <p>{busca ? 'Tente outro termo de busca.' : 'Cadastre o primeiro coordenador.'}</p>
          {isAdmin && <button className="btn btn-gold" onClick={abrirNovo}>Cadastrar coordenador</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {filtrados.map(c => (
            <div key={c.id} className="coord-card">
              <div className="coord-avatar">
                {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : iniciais(c.nome)}
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', color: 'var(--azul)', marginBottom: '4px' }}>{c.nome}</h3>
              <div className="coord-area">{c.area}</div>
              <p className="coord-desc">{c.descricao || 'Coordenador do Instituto Nossa Senhora Menina.'}</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {c.whatsapp && (
                  <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                    className="btn btn-sm btn-whatsapp">
                    💬 WhatsApp
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="btn btn-sm btn-ghost">✉️ E-mail</a>
                )}
              </div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(c)}>✏️ Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remover(c.id)}>🗑</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Coordenador' : '👤 Novo Coordenador'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar'}
          </button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Nome Completo *</label>
          <input className="form-input" placeholder="Ex: Irmã Maria das Graças" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Área de Responsabilidade *</label>
          <input className="form-input" placeholder="Ex: Compras & Materiais" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Descrição do Papel</label>
          <textarea className="form-textarea" rows="3" placeholder="Descreva as responsabilidades desta pessoa..."
            value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">WhatsApp (com DDD)</label>
            <input className="form-input" placeholder="11999887766" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" placeholder="coord@insm.org.br" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
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
