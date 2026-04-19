import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { gerarRelatorioComprasPDF } from '../lib/pdf'

const CATS = ['Material de Arte', 'Papelaria', 'Limpeza', 'Alimentos', 'Liturgia', 'Informática', 'Outros']
const EMPTY = { data: new Date().toISOString().slice(0,10), item: '', categoria: CATS[0], quantidade: 1, valor_unitario: '', atividade_id: '', atividade_nome: '', responsavel: '', observacao: '' }

const CORES_CAT = {
  'Material de Arte': 'linear-gradient(90deg,#1a3a6b,#4a7fcb)',
  'Papelaria':        'linear-gradient(90deg,#c9a227,#e8c547)',
  'Limpeza':          'linear-gradient(90deg,#2e7d52,#52c27d)',
  'Alimentos':        'linear-gradient(90deg,#d4680a,#f0a940)',
  'Liturgia':         'linear-gradient(90deg,#7b2fa0,#c29ee0)',
  'Informática':      'linear-gradient(90deg,#2980b9,#74b9ff)',
  'Outros':           'linear-gradient(90deg,#7f8c8d,#bdc3c7)',
}

function BarChart({ dados, max }) {
  return (
    <div className="bar-chart">
      {dados.map(([label, valor], i) => (
        <div key={label} className="bar-row">
          <div className="bar-label"><span>{label}</span><span>R$ {Number(valor).toFixed(2)}</span></div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: max > 0 ? `${(valor / max) * 100}%` : '0%', background: CORES_CAT[label] || 'linear-gradient(90deg,#1a3a6b,#4a7fcb)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Materiais() {
  const { isCoord, nomeUser } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState([])
  const [atividades, setAtividades] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filtroAt, setFiltroAt] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({ ...EMPTY, responsavel: nomeUser })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cmpRes, atRes] = await Promise.all([
      supabase.from('compras').select('*').order('data', { ascending: false }).order('criado_em', { ascending: false }),
      supabase.from('atividades').select('id, titulo').order('data', { ascending: false })
    ])
    setLista(cmpRes.data || [])
    setAtividades(atRes.data || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.item.trim() || !form.data) { toast('Item e data são obrigatórios.', 'error'); return }
    setSaving(true)
    const payload = {
      ...form,
      quantidade: parseFloat(form.quantidade) || 1,
      valor_unitario: parseFloat(form.valor_unitario) || 0,
    }
    const { error } = await supabase.from('compras').insert(payload)
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast('Compra registrada!'); setModalOpen(false); setForm({ ...EMPTY, responsavel: nomeUser }); load() }
    setSaving(false)
  }

  async function remover(id) {
    if (!confirm('Excluir este registro?')) return
    await supabase.from('compras').delete().eq('id', id)
    toast('Registro excluído.')
    load()
  }

  const filtrados = lista.filter(c => {
    const matchAt  = !filtroAt  || c.atividade_id === filtroAt || c.atividade_nome?.includes(filtroAt)
    const matchCat = !filtroCat || c.categoria === filtroCat
    const matchB   = !busca    || c.item.toLowerCase().includes(busca.toLowerCase())
    return matchAt && matchCat && matchB
  })

  const totalGeral = filtrados.reduce((s, c) => s + (Number(c.valor_total) || 0), 0)

  // Gráfico por categoria
  const porCat = {}
  filtrados.forEach(c => { porCat[c.categoria || 'Outros'] = (porCat[c.categoria || 'Outros'] || 0) + (Number(c.valor_total) || 0) })
  const catEntries = Object.entries(porCat).sort((a, b) => b[1] - a[1])
  const maxCat = catEntries[0]?.[1] || 1

  // Gráfico por atividade
  const porAt = {}
  filtrados.forEach(c => { const k = c.atividade_nome || 'Geral / Sem atividade'; porAt[k] = (porAt[k] || 0) + (Number(c.valor_total) || 0) })
  const atEntries = Object.entries(porAt).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxAt = atEntries[0]?.[1] || 1

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Materiais Comprados</h1>
          <p className="page-subtitle">Histórico de compras por atividade com relatórios</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => gerarRelatorioComprasPDF(filtrados, `Relatório de Compras${filtroCat ? ' — ' + filtroCat : ''}`)}>
            📊 Relatório PDF
          </button>
          {isCoord && <button className="btn btn-gold" onClick={() => setModalOpen(true)}>+ Registrar Compra</button>}
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '22px' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">💰 Gastos por Categoria</span></div>
          <div className="card-body">
            {catEntries.length === 0 ? <p style={{ color: 'var(--cinza)', fontSize: '13px' }}>Sem dados.</p> : <BarChart dados={catEntries} max={maxCat} />}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">📊 Gastos por Atividade</span></div>
          <div className="card-body">
            {atEntries.length === 0 ? <p style={{ color: 'var(--cinza)', fontSize: '13px' }}>Sem dados.</p>
              : <BarChart dados={atEntries} max={maxAt} />}
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Histórico de Compras</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-wrap" style={{ minWidth: '180px' }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <select className="form-select" style={{ width: 'auto', padding: '8px 32px 8px 12px', fontSize: '13px' }}
              value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
              <option value="">Todas as categorias</option>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', padding: '8px 32px 8px 12px', fontSize: '13px' }}
              value={filtroAt} onChange={e => setFiltroAt(e.target.value)}>
              <option value="">Todas as atividades</option>
              {atividades.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="loading-center"><div className="spinner" /></div>
          : filtrados.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🛒</span>
              <h3>Nenhuma compra encontrada</h3>
              {isCoord && <button className="btn btn-gold" onClick={() => setModalOpen(true)}>Registrar compra</button>}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Item</th>
                      <th>Categoria</th>
                      <th style={{ textAlign: 'center' }}>Qtd</th>
                      <th style={{ textAlign: 'right' }}>Vlr Unit</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th>Atividade</th>
                      <th>Responsável</th>
                      {isCoord && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map(c => (
                      <tr key={c.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '12.5px' }}>{c.data ? new Date(c.data + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td><strong style={{ fontSize: '13px' }}>{c.item}</strong>{c.observacao && <div style={{ fontSize: '11px', color: 'var(--cinza)' }}>{c.observacao}</div>}</td>
                        <td><span style={{ fontSize: '11.5px', background: 'var(--azul-suave)', color: 'var(--azul)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>{c.categoria || '—'}</span></td>
                        <td style={{ textAlign: 'center', fontWeight: '700' }}>{c.quantidade}</td>
                        <td style={{ textAlign: 'right', fontSize: '12.5px', color: 'var(--cinza-medio)' }}>R$ {Number(c.valor_unitario || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: 'var(--azul)', fontSize: '13.5px' }}>R$ {Number(c.valor_total || 0).toFixed(2)}</td>
                        <td style={{ fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.atividade_nome || <span style={{ color: 'var(--cinza)' }}>—</span>}</td>
                        <td style={{ fontSize: '12.5px' }}>{c.responsavel || '—'}</td>
                        {isCoord && <td><button className="btn btn-sm btn-danger" onClick={() => remover(c.id)}>🗑</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '14px 20px', borderTop: '2px solid var(--borda)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', background: 'var(--creme)' }}>
                <span style={{ fontSize: '13px', color: 'var(--cinza-medio)' }}>Total {filtrados.length !== lista.length ? 'filtrado' : 'geral'}:</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: 'var(--azul)' }}>R$ {totalGeral.toFixed(2)}</span>
              </div>
            </>
          )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title="🛒 Registrar Compra de Material"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? '⏳ Salvando...' : 'Registrar Compra'}</button>
        </>}
      >
        <div className="form-group">
          <label className="form-label">Item Comprado *</label>
          <input className="form-input" placeholder="Ex: Tinta guache 12 cores (kit)" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} />
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <select className="form-select" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Data da Compra *</label>
            <input className="form-input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Quantidade</label>
            <input className="form-input" type="number" min="0.1" step="0.1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Valor Unitário (R$)</label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor_unitario} onChange={e => setForm(f => ({ ...f, valor_unitario: e.target.value }))} />
          </div>
        </div>
        {form.quantidade && form.valor_unitario && (
          <div className="alert alert-gold" style={{ marginTop: '-4px', marginBottom: '14px' }}>
            <span className="alert-icon">💰</span>
            <span>Total: <strong>R$ {(parseFloat(form.quantidade || 0) * parseFloat(form.valor_unitario || 0)).toFixed(2)}</strong></span>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Atividade Relacionada</label>
          <select className="form-select" value={form.atividade_id}
            onChange={e => {
              const at = atividades.find(a => a.id === e.target.value)
              setForm(f => ({ ...f, atividade_id: e.target.value, atividade_nome: at?.titulo || '' }))
            }}>
            <option value="">Sem atividade específica / Geral</option>
            {atividades.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}
          </select>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Responsável pela Compra</label>
            <input className="form-input" placeholder="Nome do responsável" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Observação</label>
            <input className="form-input" placeholder="Observações opcionais" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
