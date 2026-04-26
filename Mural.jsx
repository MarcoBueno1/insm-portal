import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { registrarAuditoria } from '../lib/auditoria'

const TIPOS = [
  { value: 'aviso',    label: '📢 Aviso Geral',   icon: '📢' },
  { value: 'urgente',  label: '🔴 Urgente',        icon: '🔴' },
  { value: 'info',     label: 'ℹ️ Informativo',    icon: 'ℹ️' },
  { value: 'conquista',label: '🌟 Conquista',      icon: '🌟' },
]

const FORM_VAZIO = { titulo: '', conteudo: '', tipo: 'aviso', fixado: false }

export default function Mural() {
  const { user, nomeUser, isCoord } = useAuth()
  const toast = useToast()
  const [avisos, setAvisos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)

  useEffect(() => { loadAvisos() }, [])

  async function loadAvisos() {
    setLoading(true)
    const { data } = await supabase.from('mural').select('*').eq('ativo', true)
      .order('fixado', { ascending: false }).order('criado_em', { ascending: false })
    setAvisos(data || [])
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setModalOpen(true)
  }

  function abrirEditar(aviso) {
    setEditando(aviso)
    setForm({ titulo: aviso.titulo, conteudo: aviso.conteudo, tipo: aviso.tipo, fixado: aviso.fixado })
    setModalOpen(true)
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      toast('Preencha título e conteúdo.', 'error'); return
    }
    setSaving(true)

    if (editando) {
      const anterior = { titulo: editando.titulo, conteudo: editando.conteudo, tipo: editando.tipo, fixado: editando.fixado }
      const { error } = await supabase.from('mural').update({
        titulo: form.titulo,
        conteudo: form.conteudo,
        tipo: form.tipo,
        fixado: form.fixado,
        atualizado_em: new Date().toISOString(),
      }).eq('id', editando.id)

      if (error) {
        toast('Erro ao editar: ' + error.message, 'error')
      } else {
        await registrarAuditoria({
          tabela: 'mural', registro_id: editando.id, acao: 'editar',
          descricao: 'Aviso "' + form.titulo + '" editado',
          valor_anterior: anterior, valor_novo: form,
          usuario_id: user.id, usuario_nome: nomeUser,
        })
        toast('Aviso atualizado com sucesso!')
        setModalOpen(false)
        loadAvisos()
      }
    } else {
      const { data, error } = await supabase.from('mural').insert({
        ...form, autor_id: user.id, autor_nome: nomeUser,
      }).select().single()

      if (error) {
        toast('Erro ao publicar: ' + error.message, 'error')
      } else {
        await registrarAuditoria({
          tabela: 'mural', registro_id: data?.id, acao: 'criar',
          descricao: 'Aviso "' + form.titulo + '" publicado',
          valor_novo: form, usuario_id: user.id, usuario_nome: nomeUser,
        })
        toast('Aviso publicado no mural!')
        setModalOpen(false)
        setForm(FORM_VAZIO)
        loadAvisos()
      }
    }
    setSaving(false)
  }

  async function remover(aviso) {
    if (!confirm('Remover este aviso do mural?')) return
    await supabase.from('mural').update({ ativo: false }).eq('id', aviso.id)
    await registrarAuditoria({
      tabela: 'mural', registro_id: aviso.id, acao: 'remover',
      descricao: 'Aviso "' + aviso.titulo + '" removido',
      valor_anterior: { titulo: aviso.titulo, tipo: aviso.tipo },
      usuario_id: user.id, usuario_nome: nomeUser,
    })
    toast('Aviso removido.')
    loadAvisos()
  }

  async function toggleFixado(id, fixado) {
    await supabase.from('mural').update({ fixado: !fixado }).eq('id', id)
    loadAvisos()
  }

  const filtrados = filtro === 'todos' ? avisos : avisos.filter(a => a.tipo === filtro)

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📌 Mural de Avisos</h1>
          <p className="page-subtitle">Comunicados, informações e conquistas do Instituto</p>
        </div>
        <div className="page-actions">
          <div className="tabs">
            {['todos', 'aviso', 'urgente', 'info', 'conquista'].map(t => (
              <button key={t} className={'tab ' + (filtro === t ? 'active' : '')} onClick={() => setFiltro(t)}>
                {t === 'todos' ? 'Todos' : TIPOS.find(x => x.value === t)?.label}
              </button>
            ))}
          </div>
          {isCoord && (
            <button className="btn btn-gold" onClick={abrirNovo}>+ Novo Aviso</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📌</span>
          <h3>Nenhum aviso encontrado</h3>
          <p>Ainda não há avisos publicados nesta categoria.</p>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>Publicar primeiro aviso</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
          {filtrados.map(a => (
            <div key={a.id} className={'mural-card ' + a.tipo}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className={'badge badge-' + a.tipo}>
                  {TIPOS.find(t => t.value === a.tipo)?.label}
                </span>
                {a.fixado && <span title="Fixado" style={{ fontSize: '14px' }}>📍</span>}
              </div>
              <h3>{a.titulo}</h3>
              <p>{a.conteudo}</p>
              <div className="mural-meta">
                <span>👤 {a.autor_nome || 'Sistema'}</span>
                <span>📅 {new Date(a.criado_em).toLocaleDateString('pt-BR')}</span>
                {a.atualizado_em && a.atualizado_em !== a.criado_em && (
                  <span style={{ fontSize: 10, color: 'var(--cinza)', fontStyle: 'italic' }}>✏️ editado</span>
                )}
                {isCoord && (
                  <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                    <button className="btn btn-sm btn-ghost" title="Editar aviso"
                      onClick={() => abrirEditar(a)} style={{ padding: '4px 8px', fontSize: '13px' }}>✏️</button>
                    <button className="btn btn-sm btn-ghost" title={a.fixado ? 'Desafixar' : 'Fixar'}
                      onClick={() => toggleFixado(a.id, a.fixado)} style={{ padding: '4px 8px', fontSize: '13px' }}>
                      {a.fixado ? '📌' : '📍'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remover(a)} style={{ padding: '4px 8px', fontSize: '13px' }}>🗑</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Aviso' : '📌 Novo Aviso no Mural'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>
            {saving ? '⏳ Salvando...' : editando ? 'Salvar Alterações' : 'Publicar Aviso'}
          </button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Título do Aviso</label>
          <input className="form-input" placeholder="Ex: Reunião de Coordenadores — Maio"
            value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Conteúdo</label>
          <textarea className="form-textarea" rows="4" placeholder="Descreva o aviso com todos os detalhes importantes..."
            value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '0' }}>
              <input type="checkbox" checked={form.fixado} onChange={e => setForm(f => ({ ...f, fixado: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <span style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--texto)' }}>📍 Fixar no topo</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
