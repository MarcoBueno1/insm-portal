import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'

const EMPTY = { nome: '', telefone: '', email: '', cpf: '', observacoes: '' }

export default function LojaClientes() {
  const { isCoord } = useAuth()
  const toast = useToast()

  const [lista, setLista]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [busca, setBusca]         = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando]   = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('loja_clientes').select('*').order('nome')
    setLista(data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModalOpen(true) }

  function abrirEditar(c) {
    setForm({ nome: c.nome, telefone: c.telefone || '', email: c.email || '', cpf: c.cpf || '', observacoes: c.observacoes || '' })
    setEditando(c.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { toast('Informe o nome do cliente.', 'error'); return }
    setSaving(true)
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      email: form.email || null,
      cpf: form.cpf || null,
      observacoes: form.observacoes || null,
    }
    let error
    if (editando) {
      ;({ error } = await supabase.from('loja_clientes')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', editando))
    } else {
      ;({ error } = await supabase.from('loja_clientes').insert(payload))
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Cliente atualizado!' : '✅ Cliente cadastrado!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function alternarAtivo(c) {
    await supabase.from('loja_clientes').update({ ativo: !c.ativo, atualizado_em: new Date().toISOString() }).eq('id', c.id)
    toast(c.ativo ? 'Cliente desativado.' : 'Cliente reativado.')
    load()
  }

  const listaFiltrada = lista.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (c.telefone || '').includes(busca) ||
    (c.email || '').toLowerCase().includes(busca.toLowerCase()) ||
    (c.cpf || '').includes(busca)
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Clientes da Loja</h1>
          <p className="page-subtitle">Cadastro de clientes para vincular aos pedidos (opcional)</p>
        </div>
        <div className="page-actions">
          {isCoord && <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Carregando...</span></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <div className="search-wrap" style={{ flex: 1 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar por nome, telefone, e-mail ou CPF..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--cinza)', whiteSpace: 'nowrap' }}>{listaFiltrada.length} cliente(s)</span>
          </div>

          {listaFiltrada.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">👥</span>
              <h3>Nenhum cliente encontrado</h3>
              <p>Clientes são opcionais — pedidos podem ser feitos para "Consumidor Final".</p>
              {isCoord && <button className="btn btn-primary" onClick={abrirNovo}>+ Novo Cliente</button>}
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>CPF</th><th>Status</th><th style={{ textAlign: 'center' }}>Ações</th></tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.nome}</strong>{c.observacoes && <div style={{ fontSize: 11.5, color: 'var(--cinza)', marginTop: 2 }}>{c.observacoes}</div>}</td>
                        <td>
                          {c.telefone ? (
                            <a href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-whatsapp" style={{ textDecoration: 'none' }}>
                              📱 {c.telefone}
                            </a>
                          ) : <span style={{ color: 'var(--cinza)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12.5 }}>{c.email || <span style={{ color: 'var(--cinza)' }}>—</span>}</td>
                        <td style={{ fontSize: 12.5 }}>{c.cpf || <span style={{ color: 'var(--cinza)' }}>—</span>}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 20, background: c.ativo ? 'var(--verde-bg)' : 'var(--vermelho-bg)', color: c.ativo ? 'var(--verde)' : 'var(--vermelho)' }}>
                            {c.ativo ? '✅ Ativo' : '⛔ Inativo'}
                          </span>
                        </td>
                        <td>
                          {isCoord && (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(c)}>✏️ Editar</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => alternarAtivo(c)}>
                                {c.ativo ? '⛔ Desativar' : '✅ Ativar'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Cliente' : '👥 Novo Cliente'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? '⏳...' : 'Salvar'}</button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">Nome completo *</label>
          <input className="form-input" placeholder="Nome do cliente" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Telefone / WhatsApp</label>
            <input className="form-input" placeholder="(11) 99999-9999" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">CPF</label>
            <input className="form-input" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input className="form-input" type="email" placeholder="email@exemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Observações</label>
          <input className="form-input" placeholder="Alguma observação sobre o cliente..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
