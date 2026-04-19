import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { gerarRelatorioEstoquePDF } from '../lib/pdf'

const CATS = ['Material de Arte', 'Papelaria', 'Limpeza', 'Alimentos', 'Liturgia', 'Informática', 'Outros']
const UNS  = ['un', 'cx', 'pacote', 'resma', 'kg', 'L', 'par', 'rolo']
const EMPTY = { produto: '', categoria: CATS[0], qtd_atual: '', qtd_minima: '', unidade: 'un', observacao: '' }

function statusEstoque(qtd, min) {
  if (qtd <= 0) return 'critico'
  if (qtd <= min) return 'baixo'
  return 'ok'
}
const STATUS_LABEL = { ok: '✅ OK', baixo: '⚠️ Baixo', critico: '🔴 Crítico' }

export default function Estoque() {
  const { isCoord } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMov, setModalMov] = useState(null) // item selecionado para movimentação
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [mov, setMov] = useState({ tipo: 'entrada', quantidade: '', motivo: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('estoque').select('*').order('produto')
    setLista(data || [])
    setLoading(false)
  }

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModalOpen(true) }
  function abrirEditar(item) {
    setForm({ produto: item.produto, categoria: item.categoria || CATS[0], qtd_atual: item.qtd_atual, qtd_minima: item.qtd_minima, unidade: item.unidade || 'un', observacao: item.observacao || '' })
    setEditando(item.id); setModalOpen(true)
  }

  async function salvar() {
    if (!form.produto.trim()) { toast('Informe o nome do produto.', 'error'); return }
    setSaving(true)
    const payload = { ...form, qtd_atual: parseFloat(form.qtd_atual) || 0, qtd_minima: parseFloat(form.qtd_minima) || 0 }
    let error
    if (editando) {
      ({ error } = await supabase.from('estoque').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando))
    } else {
      ({ error } = await supabase.from('estoque').insert(payload))
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(editando ? 'Item atualizado!' : 'Item cadastrado!'); setModalOpen(false); load() }
    setSaving(false)
  }

  async function registrarMovimentacao() {
    if (!mov.quantidade || parseFloat(mov.quantidade) <= 0) { toast('Informe a quantidade.', 'error'); return }
    setSaving(true)
    const item = modalMov
    const delta = mov.tipo === 'entrada' ? parseFloat(mov.quantidade) : -parseFloat(mov.quantidade)
    const novaQtd = Math.max(0, item.qtd_atual + delta)
    const { error } = await supabase.from('estoque').update({ qtd_atual: novaQtd, atualizado_em: new Date().toISOString() }).eq('id', item.id)
    if (!error) {
      await supabase.from('movimentacoes_estoque').insert({ estoque_id: item.id, tipo: mov.tipo, quantidade: parseFloat(mov.quantidade), motivo: mov.motivo })
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast(`${mov.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'} registrada!`); setModalMov(null); setMov({ tipo: 'entrada', quantidade: '', motivo: '' }); load() }
    setSaving(false)
  }

  async function remover(id) {
    if (!confirm('Excluir este item do estoque?')) return
    await supabase.from('estoque').delete().eq('id', id)
    toast('Item removido.')
    load()
  }

  const filtrados = lista.filter(e => {
    const st = statusEstoque(e.qtd_atual, e.qtd_minima)
    const matchFiltro = filtro === 'todos' || st === filtro
    const matchBusca = !busca || e.produto.toLowerCase().includes(busca.toLowerCase()) || (e.categoria || '').toLowerCase().includes(busca.toLowerCase())
    return matchFiltro && matchBusca
  })

  const criticos = lista.filter(e => statusEstoque(e.qtd_atual, e.qtd_minima) === 'critico').length
  const baixos   = lista.filter(e => statusEstoque(e.qtd_atual, e.qtd_minima) === 'baixo').length

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Controle de Estoque</h1>
          <p className="page-subtitle">Gerencie produtos, quantidades e movimentações</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => gerarRelatorioEstoquePDF(lista)}>📄 Relatório PDF</button>
          {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>+ Cadastrar Item</button>}
        </div>
      </div>

      {(criticos > 0 || baixos > 0) && (
        <div className="alert alert-red" style={{ marginBottom: '20px' }}>
          <span className="alert-icon">⚠️</span>
          <div>
            {criticos > 0 && <><strong>{criticos} item(s) com estoque crítico (zerado)</strong> — reposição urgente necessária. </>}
            {baixos > 0 && <><strong>{baixos} item(s) com estoque abaixo do mínimo.</strong></>}
          </div>
        </div>
      )}

      {/* Resumo visual */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '22px' }}>
        {[
          { label: 'Total de Itens', val: lista.length, cor: 'var(--azul)', icon: '📦' },
          { label: 'Estoque Baixo',  val: baixos,        cor: 'var(--laranja)', icon: '⚠️' },
          { label: 'Estoque Crítico',val: criticos,      cor: 'var(--vermelho)', icon: '🔴' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '18px', border: '1px solid var(--borda)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '26px' }}>{s.icon}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: s.cor, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Itens em Estoque</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {[['todos', 'Todos'], ['ok', '✅ OK'], ['baixo', '⚠️ Baixo'], ['critico', '🔴 Crítico']].map(([v, l]) => (
                <button key={v} className={`tab ${filtro === v ? 'active' : ''}`} onClick={() => setFiltro(v)}>{l}</button>
              ))}
            </div>
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div>
          : filtrados.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📦</span>
              <h3>Nenhum item encontrado</h3>
              {isCoord && <button className="btn btn-gold" onClick={abrirNovo}>Cadastrar primeiro item</button>}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th style={{ textAlign: 'center' }}>Qtd Atual</th>
                    <th style={{ textAlign: 'center' }}>Qtd Mínima</th>
                    <th style={{ textAlign: 'center' }}>Unidade</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    {isCoord && <th style={{ textAlign: 'center' }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(e => {
                    const st = statusEstoque(e.qtd_atual, e.qtd_minima)
                    return (
                      <tr key={e.id}>
                        <td><strong style={{ color: 'var(--azul)' }}>{e.produto}</strong>{e.observacao && <div style={{ fontSize: '11px', color: 'var(--cinza)' }}>{e.observacao}</div>}</td>
                        <td><span style={{ fontSize: '12px', background: 'var(--cinza-cl)', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{e.categoria || '—'}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', color: st === 'critico' ? 'var(--vermelho)' : st === 'baixo' ? 'var(--laranja)' : 'var(--verde)' }}>
                            {e.qtd_atual}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--cinza-medio)', fontSize: '13px' }}>{e.qtd_minima}</td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--cinza-medio)' }}>{e.unidade || 'un'}</td>
                        <td style={{ textAlign: 'center' }}><span className={`badge badge-${st}`}>{STATUS_LABEL[st]}</span></td>
                        {isCoord && (
                          <td>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button className="btn btn-sm btn-success" title="Movimentar" onClick={() => { setModalMov(e); setMov({ tipo: 'entrada', quantidade: '', motivo: '' }) }}>📥📤</button>
                              <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(e)}>✏️</button>
                              <button className="btn btn-sm btn-danger" onClick={() => remover(e.id)}>🗑</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Modal cadastro/edição */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editando ? '✏️ Editar Item' : '📦 Novo Item no Estoque'}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : 'Salvar'}</button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Nome do Produto *</label>
          <input className="form-input" placeholder="Ex: Lápis de cor caixa 12 cores" value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Categoria</label>
          <select className="form-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Qtd. Atual</label>
            <input className="form-input" type="number" min="0" step="0.5" placeholder="0" value={form.qtd_atual} onChange={e => setForm(f => ({ ...f, qtd_atual: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Qtd. Mínima</label>
            <input className="form-input" type="number" min="0" step="0.5" placeholder="5" value={form.qtd_minima} onChange={e => setForm(f => ({ ...f, qtd_minima: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Unidade</label>
            <select className="form-select" value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}>
              {UNS.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Observação</label>
          <input className="form-input" placeholder="Observações opcionais..." value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
        </div>
      </Modal>

      {/* Modal movimentação */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)}
        title={`📦 Movimentar Estoque — ${modalMov?.produto}`}
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalMov(null)}>Cancelar</button>
          <button className={`btn ${mov.tipo === 'entrada' ? 'btn-success' : 'btn-danger'}`} onClick={registrarMovimentacao} disabled={saving}>
            {saving ? '⏳...' : mov.tipo === 'entrada' ? '📥 Registrar Entrada' : '📤 Registrar Saída'}
          </button>
        </>}
      >
        {modalMov && (
          <>
            <div className="alert alert-blue" style={{ marginBottom: '16px' }}>
              <span className="alert-icon">📦</span>
              <div>Quantidade atual: <strong style={{ fontSize: '16px' }}>{modalMov.qtd_atual} {modalMov.unidade}</strong></div>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de Movimentação</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[['entrada', '📥 Entrada', 'var(--verde)'], ['saida', '📤 Saída', 'var(--vermelho)']].map(([v, l, c]) => (
                  <button key={v} onClick={() => setMov(m => ({ ...m, tipo: v }))}
                    style={{ padding: '12px', border: `2px solid ${mov.tipo === v ? c : 'var(--borda)'}`, borderRadius: '10px', background: mov.tipo === v ? `${c}18` : 'white', cursor: 'pointer', fontWeight: '700', color: mov.tipo === v ? c : 'var(--cinza-medio)', fontSize: '13.5px', transition: 'all 0.15s', fontFamily: 'var(--font-body)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Quantidade *</label>
              <input className="form-input" type="number" min="0.5" step="0.5" placeholder="Ex: 10"
                value={mov.quantidade} onChange={e => setMov(m => ({ ...m, quantidade: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Motivo / Observação</label>
              <input className="form-input" placeholder="Ex: Compra para oficina de arte, Uso na atividade..."
                value={mov.motivo} onChange={e => setMov(m => ({ ...m, motivo: e.target.value }))} />
            </div>
            {mov.quantidade && (
              <div className="alert alert-gold">
                <span className="alert-icon">ℹ️</span>
                <span>Nova quantidade será: <strong>{Math.max(0, modalMov.qtd_atual + (mov.tipo === 'entrada' ? 1 : -1) * parseFloat(mov.quantidade || 0))} {modalMov.unidade}</strong></span>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
