import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'
import { gerarPixPayload, pixQrCodeUrl, gerarTxId } from '../lib/pix'
import { gerarPdfPedidoLoja, imprimirQrCodePix } from '../lib/pdfLoja'

// ── Configuração Pix ──────────────────────────────────────────
// Preencha com os dados reais no .env.local:
//   VITE_PIX_CHAVE=sua_chave
//   VITE_PIX_NOME=Instituto Nossa Senhora Menina
//   VITE_PIX_CIDADE=SAO PAULO
const PIX_CONFIG = {
  chave:              import.meta.env.VITE_PIX_CHAVE    || 'CONFIGURE_VITE_PIX_CHAVE',
  nomeBeneficiario:   import.meta.env.VITE_PIX_NOME     || 'Instituto NSM',
  cidadeBeneficiario: import.meta.env.VITE_PIX_CIDADE   || 'SAO PAULO',
}

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS = {
  aberto:     { label: 'Aberto',            bg: 'var(--azul-suave)',   cor: 'var(--azul-medio)' },
  finalizado: { label: 'Aguard. Pagamento', bg: 'var(--laran-bg)',     cor: 'var(--laranja)'    },
  pago:       { label: 'Pago',              bg: 'var(--verde-bg)',     cor: 'var(--verde)'      },
  cancelado:  { label: 'Cancelado',         bg: 'var(--vermelho-bg)',  cor: 'var(--vermelho)'   },
}

export default function LojaPedidos() {
  const { user, nomeUser, isCoord } = useAuth()
  const toast = useToast()

  const [pedidos, setPedidos]     = useState([])
  const [produtos, setProdutos]   = useState([])
  const [clientes, setClientes]   = useState([])
  const [loading, setLoading]     = useState(true)

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [busca, setBusca]               = useState('')

  // Modal comanda
  const [modalComanda, setModalComanda] = useState(false)
  const [editandoId, setEditandoId]     = useState(null)
  const [saving, setSaving]             = useState(false)

  // Form da comanda
  const [formPedido, setFormPedido]   = useState({ cliente_id: '', nome_avulso: '', desconto: '', observacoes: '' })
  const [itensPedido, setItensPedido] = useState([])  // { produto_id, nome, preco_unitario, quantidade }
  const [itemSel, setItemSel]         = useState({ produto_id: '', quantidade: 1 })

  // Modal Pix
  const [modalPix, setModalPix]       = useState(null)  // pedido
  const [pixPayload, setPixPayload]   = useState('')
  const [pixQrUrl, setPixQrUrl]       = useState('')

  // Modal confirmar pagamento
  const [modalConfirmar, setModalConfirmar] = useState(null)  // pedido

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [pedRes, prodRes, cliRes] = await Promise.all([
      supabase
        .from('loja_pedidos')
        .select('*, loja_clientes(id,nome,telefone), loja_pedido_itens(id,produto_id,produto_nome,quantidade,preco_unitario,subtotal)')
        .order('criado_em', { ascending: false }),
      supabase.from('loja_produtos').select('id,nome,preco,qtd_atual,unidade').eq('ativo', true).order('nome'),
      supabase.from('loja_clientes').select('id,nome,telefone').eq('ativo', true).order('nome'),
    ])
    setPedidos(pedRes.data || [])
    setProdutos(prodRes.data || [])
    setClientes(cliRes.data || [])
    setLoading(false)
  }

  // ── Cálculo de totais ─────────────────────────────────────
  function calcTotais(itens, desconto) {
    const subtotal = itens.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0)
    const desc     = parseFloat(desconto) || 0
    return { subtotal, total: Math.max(0, subtotal - desc) }
  }
  const { subtotal: subAtual, total: totalAtual } = calcTotais(itensPedido, formPedido.desconto)

  // ── Abrir nova comanda ────────────────────────────────────
  function abrirNova() {
    setEditandoId(null)
    setFormPedido({ cliente_id: '', nome_avulso: '', desconto: '', observacoes: '' })
    setItensPedido([])
    setItemSel({ produto_id: '', quantidade: 1 })
    setModalComanda(true)
  }

  // ── Abrir comanda para edição ─────────────────────────────
  function abrirEditar(p) {
    if (p.status !== 'aberto') { toast('Apenas pedidos abertos podem ser editados.', 'error'); return }
    setEditandoId(p.id)
    setFormPedido({
      cliente_id: p.cliente_id || '',
      nome_avulso: p.nome_avulso || '',
      desconto: p.desconto || '',
      observacoes: p.observacoes || '',
    })
    setItensPedido((p.loja_pedido_itens || []).map(i => ({
      produto_id: i.produto_id,
      nome: i.produto_nome,
      preco_unitario: i.preco_unitario,
      quantidade: i.quantidade,
    })))
    setItemSel({ produto_id: '', quantidade: 1 })
    setModalComanda(true)
  }

  // ── Adicionar item na comanda ─────────────────────────────
  function adicionarItem() {
    if (!itemSel.produto_id) { toast('Selecione um produto.', 'error'); return }
    const prod = produtos.find(p => p.id === itemSel.produto_id)
    if (!prod) return
    const qtd = parseInt(itemSel.quantidade) || 1
    const idx = itensPedido.findIndex(i => i.produto_id === prod.id)
    if (idx >= 0) {
      const novos = [...itensPedido]
      novos[idx] = { ...novos[idx], quantidade: novos[idx].quantidade + qtd }
      setItensPedido(novos)
    } else {
      setItensPedido(prev => [...prev, { produto_id: prod.id, nome: prod.nome, preco_unitario: prod.preco, quantidade: qtd }])
    }
    setItemSel({ produto_id: '', quantidade: 1 })
  }

  function removerItem(idx) { setItensPedido(prev => prev.filter((_, i) => i !== idx)) }

  function atualizarQtd(idx, qtd) {
    const novos = [...itensPedido]
    novos[idx] = { ...novos[idx], quantidade: Math.max(1, parseInt(qtd) || 1) }
    setItensPedido(novos)
  }

  // ── Salvar comanda ────────────────────────────────────────
  async function salvarComanda(finalizar = false) {
    if (itensPedido.length === 0) { toast('Adicione pelo menos um produto à comanda.', 'error'); return }
    setSaving(true)

    const { subtotal, total } = calcTotais(itensPedido, formPedido.desconto)

    // Gera payload Pix se estiver finalizando
    const pixPayloadGerado = finalizar ? gerarPixPayload({
      chave:    PIX_CONFIG.chave,
      nome:     PIX_CONFIG.nomeBeneficiario,
      cidade:   PIX_CONFIG.cidadeBeneficiario,
      valor:    total,
      txid:     gerarTxId(editandoId || 'NOVO'),
      descricao: 'Pedido INSM Loja',
    }) : null

    const payload = {
      cliente_id:    formPedido.cliente_id || null,
      nome_avulso:   (!formPedido.cliente_id && formPedido.nome_avulso) ? formPedido.nome_avulso.trim() : null,
      desconto:      parseFloat(formPedido.desconto) || 0,
      observacoes:   formPedido.observacoes || null,
      subtotal, total,
      status:        finalizar ? 'finalizado' : 'aberto',
      vendedor_id:   user?.id,
      vendedor_nome: nomeUser,
      ...(finalizar && { pix_payload: pixPayloadGerado }),
    }

    let pedidoId = editandoId

    if (pedidoId) {
      const { error } = await supabase.from('loja_pedidos')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', pedidoId)
      if (error) { toast('Erro ao atualizar comanda: ' + error.message, 'error'); setSaving(false); return }
      // Remove itens antigos e reinsere
      await supabase.from('loja_pedido_itens').delete().eq('pedido_id', pedidoId)
    } else {
      const { data, error } = await supabase.from('loja_pedidos').insert(payload).select('id,numero').single()
      if (error) { toast('Erro ao criar comanda: ' + error.message, 'error'); setSaving(false); return }
      pedidoId = data.id
      // Agora que temos o id real, atualiza o pix_payload com o txid correto
      if (finalizar) {
        const pixCorrigido = gerarPixPayload({
          chave:    PIX_CONFIG.chave,
          nome:     PIX_CONFIG.nomeBeneficiario,
          cidade:   PIX_CONFIG.cidadeBeneficiario,
          valor:    total,
          txid:     gerarTxId(pedidoId),
          descricao: 'Pedido INSM Loja',
        })
        await supabase.from('loja_pedidos').update({ pix_payload: pixCorrigido }).eq('id', pedidoId)
      }
    }

    // Insere itens
    const itensPayload = itensPedido.map(i => ({
      pedido_id:     pedidoId,
      produto_id:    i.produto_id,
      produto_nome:  i.nome,
      quantidade:    i.quantidade,
      preco_unitario: i.preco_unitario,
    }))
    const { error: errItens } = await supabase.from('loja_pedido_itens').insert(itensPayload)
    if (errItens) { toast('Erro ao salvar itens: ' + errItens.message, 'error'); setSaving(false); return }

    toast(finalizar ? '✅ Comanda finalizada! Pix gerado.' : '💾 Comanda salva!')
    setModalComanda(false)
    setSaving(false)
    await load()

    // Abre modal Pix automaticamente se finalizou
    if (finalizar) {
      const { data: pedAtual } = await supabase
        .from('loja_pedidos')
        .select('*, loja_clientes(id,nome,telefone), loja_pedido_itens(id,produto_id,produto_nome,quantidade,preco_unitario,subtotal)')
        .eq('id', pedidoId).single()
      if (pedAtual) abrirModalPix(pedAtual)
    }
  }

  // ── Finalizar pedido aberto já existente ──────────────────
  async function finalizarExistente(p) {
    const pixPayloadGerado = gerarPixPayload({
      chave:    PIX_CONFIG.chave,
      nome:     PIX_CONFIG.nomeBeneficiario,
      cidade:   PIX_CONFIG.cidadeBeneficiario,
      valor:    Number(p.total),
      txid:     gerarTxId(p.id),
      descricao: 'Pedido INSM Loja',
    })
    const { error } = await supabase.from('loja_pedidos')
      .update({ status: 'finalizado', pix_payload: pixPayloadGerado, atualizado_em: new Date().toISOString() })
      .eq('id', p.id)
    if (error) { toast('Erro: ' + error.message, 'error'); return }
    toast('✅ Comanda finalizada! Pix gerado.')
    await load()
    const { data: pedAtual } = await supabase
      .from('loja_pedidos')
      .select('*, loja_clientes(id,nome,telefone), loja_pedido_itens(id,produto_id,produto_nome,quantidade,preco_unitario,subtotal)')
      .eq('id', p.id).single()
    if (pedAtual) abrirModalPix(pedAtual)
  }

  // ── Abrir modal Pix ───────────────────────────────────────
  function abrirModalPix(p) {
    const payload = p.pix_payload || gerarPixPayload({
      chave:    PIX_CONFIG.chave,
      nome:     PIX_CONFIG.nomeBeneficiario,
      cidade:   PIX_CONFIG.cidadeBeneficiario,
      valor:    Number(p.total),
      txid:     gerarTxId(p.id),
      descricao: 'Pedido INSM Loja',
    })
    setPixPayload(payload)
    setPixQrUrl(pixQrCodeUrl(payload, 280))
    setModalPix(p)
  }

  // ── Confirmar pagamento ───────────────────────────────────
  async function confirmarPagamento() {
    const p = modalConfirmar
    if (!p) return
    setSaving(true)

    // Marca como pago
    const { error } = await supabase.from('loja_pedidos').update({
      status: 'pago',
      pix_confirmado: true,
      pix_confirmado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }).eq('id', p.id)

    if (error) { toast('Erro ao confirmar pagamento: ' + error.message, 'error'); setSaving(false); return }

    // Baixa o estoque de cada item
    const itens = p.loja_pedido_itens || []
    for (const item of itens) {
      const { data: prod } = await supabase
        .from('loja_produtos').select('qtd_atual').eq('id', item.produto_id).single()
      if (prod) {
        const novaQtd = Math.max(0, prod.qtd_atual - item.quantidade)
        await supabase.from('loja_produtos')
          .update({ qtd_atual: novaQtd, atualizado_em: new Date().toISOString() })
          .eq('id', item.produto_id)
        await supabase.from('loja_movimentacoes').insert({
          produto_id:  item.produto_id,
          tipo:        'saida',
          quantidade:  item.quantidade,
          motivo:      `Venda — Pedido #${String(p.numero).padStart(4, '0')}`,
          pedido_id:   p.id,
          qtd_antes:   prod.qtd_atual,
          qtd_depois:  novaQtd,
          usuario_id:  user?.id,
          usuario_nome: nomeUser,
        })
      }
    }

    // ── Gera lançamento em Contas a Receber ──────────────────
    const nomeCliente = p.loja_clientes?.nome || p.nome_avulso || 'Consumidor Final'
    const dataHoje = new Date().toISOString().split('T')[0]
    const descricaoLanc = `Venda Loja #${String(p.numero).padStart(4,'0')} — ${nomeCliente}`
    await supabase.from('financeiro').insert({
      tipo:            'receber',
      descricao:       descricaoLanc,
      valor:           Number(p.total),
      categoria:       'Loja',
      data_vencimento: dataHoje,
      data_pagamento:  dataHoje,
      status:          'pago',
      favorecido:      nomeCliente,
      observacao:      `Gerado automaticamente. Pedido #${String(p.numero).padStart(4,'0')}${p.vendedor_nome ? ' · Vendedor: ' + p.vendedor_nome : ''} · ${(p.loja_pedido_itens||[]).length} iten(s)`,
      criado_por:      user?.id,
      criado_por_nome: nomeUser,
    })

    toast('✅ Pagamento confirmado! Estoque atualizado e lançamento financeiro criado.')
    setModalConfirmar(null)
    setModalPix(null)
    setSaving(false)
    load()
  }

  // ── Cancelar pedido ───────────────────────────────────────
  async function cancelarPedido(p) {
    if (!confirm(`Cancelar o Pedido #${String(p.numero).padStart(4, '0')}?`)) return
    await supabase.from('loja_pedidos')
      .update({ status: 'cancelado', atualizado_em: new Date().toISOString() })
      .eq('id', p.id)
    toast('Pedido cancelado.')
    load()
  }

  // ── Filtros ───────────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p => {
    const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
    const nomeCliente = p.loja_clientes?.nome || p.nome_avulso || ''
    const matchBusca  = String(p.numero).includes(busca) ||
      nomeCliente.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchBusca
  })

  // Stats
  const stats = {
    abertos:    pedidos.filter(p => p.status === 'aberto').length,
    aguardando: pedidos.filter(p => p.status === 'finalizado').length,
    pagos:      pedidos.filter(p => p.status === 'pago').length,
    totalVendas: pedidos.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.total), 0),
  }

  const produtoSelecionado = produtos.find(p => p.id === itemSel.produto_id)

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🛒 Comandas da Loja</h1>
          <p className="page-subtitle">Pedidos, geração de Pix e confirmação de pagamento</p>
        </div>
        <div className="page-actions">
          {isCoord && <button className="btn btn-primary" onClick={abrirNova}>+ Nova Comanda</button>}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Carregando...</span></div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }} className="stat-grid-4">
            <div className="stat-card blue">
              <span className="stat-icon">📋</span>
              <div className="stat-value">{stats.abertos}</div>
              <div className="stat-label">Abertas</div>
            </div>
            <div className="stat-card orange">
              <span className="stat-icon">⏳</span>
              <div className="stat-value">{stats.aguardando}</div>
              <div className="stat-label">Aguard. Pgto.</div>
            </div>
            <div className="stat-card green">
              <span className="stat-icon">✅</span>
              <div className="stat-value">{stats.pagos}</div>
              <div className="stat-label">Pagas</div>
            </div>
            <div className="stat-card gold">
              <span className="stat-icon">💰</span>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(stats.totalVendas)}</div>
              <div className="stat-label">Total em vendas</div>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar por nº ou cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className="tabs">
              {[['todos','Todos'],['aberto','Abertos'],['finalizado','Aguard. Pgto.'],['pago','Pagos'],['cancelado','Cancelados']].map(([v, l]) => (
                <button key={v} className={`tab${filtroStatus === v ? ' active' : ''}`} onClick={() => setFiltroStatus(v)}>{l}</button>
              ))}
            </div>
          </div>

          {/* Lista de pedidos */}
          {pedidosFiltrados.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🛒</span>
              <h3>Nenhuma comanda encontrada</h3>
              <p>Crie a primeira comanda para começar a registrar vendas.</p>
              {isCoord && <button className="btn btn-primary" onClick={abrirNova}>+ Nova Comanda</button>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pedidosFiltrados.map(p => {
                const st = STATUS[p.status] || STATUS.aberto
                const nomeCliente = p.loja_clientes?.nome || p.nome_avulso || 'Consumidor Final'
                const itens = p.loja_pedido_itens || []
                return (
                  <div key={p.id} className="card" style={{ overflow: 'visible' }}>
                    <div style={{ padding: '14px 18px' }}>
                      {/* Linha 1: número + status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--azul)' }}>
                            Pedido #{String(p.numero).padStart(4, '0')}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.cor }}>
                            {st.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--cinza)' }}>
                          {new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Linha 2: cliente + itens + total */}
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>Cliente</span>
                          <div style={{ fontWeight: 700, color: 'var(--texto)' }}>{nomeCliente}</div>
                        </div>
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontSize: 10.5, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>Itens</span>
                          <div style={{ color: 'var(--cinza-medio)' }}>
                            {itens.slice(0, 3).map(i => `${i.produto_nome} (${i.quantidade})`).join(', ')}
                            {itens.length > 3 && ` +${itens.length - 3} mais`}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, marginLeft: 'auto' }}>
                          <span style={{ fontSize: 10.5, color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>Total</span>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--azul)' }}>{fmt(p.total)}</div>
                        </div>
                      </div>

                      {/* Ações */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--borda)', paddingTop: 10 }}>
                        {p.status === 'aberto' && isCoord && (
                          <>
                            <button className="btn btn-sm btn-outline" onClick={() => abrirEditar(p)}>✏️ Editar</button>
                            <button className="btn btn-sm btn-primary" onClick={() => finalizarExistente(p)}>✅ Finalizar & Pix</button>
                            <button className="btn btn-sm btn-danger" onClick={() => cancelarPedido(p)}>✕ Cancelar</button>
                          </>
                        )}
                        {p.status === 'finalizado' && (
                          <>
                            <button className="btn btn-sm btn-primary" onClick={() => abrirModalPix(p)}>💳 Ver QR Pix</button>
                            {isCoord && <button className="btn btn-sm btn-success" onClick={() => setModalConfirmar(p)}>✅ Confirmar Pgto.</button>}
                          </>
                        )}
                        {p.status === 'pago' && (
                          <span style={{ fontSize: 12.5, color: 'var(--verde)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                            ✅ Pago em {p.pix_confirmado_em ? new Date(p.pix_confirmado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </span>
                        )}
                        <button className="btn btn-sm btn-ghost" onClick={() => gerarPdfPedidoLoja(p, PIX_CONFIG)}>📄 PDF</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════
          Modal: Nova / Editar Comanda
      ══════════════════════════════════════ */}
      <Modal open={modalComanda} onClose={() => setModalComanda(false)} size="lg"
        title={editandoId ? '✏️ Editar Comanda' : '🛒 Nova Comanda'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalComanda(false)}>Cancelar</button>
            <button className="btn btn-outline" onClick={() => salvarComanda(false)} disabled={saving}>
              {saving ? '⏳...' : '💾 Salvar (aberto)'}
            </button>
            <button className="btn btn-primary" onClick={() => salvarComanda(true)} disabled={saving}>
              {saving ? '⏳...' : '✅ Finalizar & Gerar Pix'}
            </button>
          </>
        }>

        {/* Cliente */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
          <div className="form-group">
            <label className="form-label">Cliente cadastrado</label>
            <select className="form-select" value={formPedido.cliente_id}
              onChange={e => setFormPedido(f => ({ ...f, cliente_id: e.target.value, nome_avulso: '' }))}>
              <option value="">— Sem cadastro —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Ou informe o nome</label>
            <input className="form-input" placeholder="Consumidor final..."
              disabled={!!formPedido.cliente_id}
              value={formPedido.nome_avulso}
              onChange={e => setFormPedido(f => ({ ...f, nome_avulso: e.target.value }))} />
          </div>
        </div>

        {/* Adicionar produto */}
        <div style={{ background: 'var(--cinza-cl)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Adicionar Produto</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label className="form-label">Produto</label>
              <select className="form-select" value={itemSel.produto_id}
                onChange={e => setItemSel(s => ({ ...s, produto_id: e.target.value }))}>
                <option value="">Selecionar produto...</option>
                {produtos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {fmt(p.preco)} (estq: {p.qtd_atual} {p.unidade})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ width: 80, marginBottom: 0 }}>
              <label className="form-label">Qtd</label>
              <input className="form-input" type="number" min="1" step="1" value={itemSel.quantidade}
                onChange={e => setItemSel(s => ({ ...s, quantidade: e.target.value }))} />
            </div>
            <button className="btn btn-outline" style={{ height: 42 }} onClick={adicionarItem}>+ Adicionar</button>
          </div>
          {produtoSelecionado && (
            <div style={{ fontSize: 12, color: 'var(--cinza-medio)', marginTop: 6 }}>
              💰 Preço: <strong>{fmt(produtoSelecionado.preco)}</strong> &nbsp;|&nbsp;
              📦 Em estoque: <strong>{produtoSelecionado.qtd_atual} {produtoSelecionado.unidade}</strong>
            </div>
          )}
        </div>

        {/* Tabela de itens */}
        {itensPedido.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Produto</th><th style={{ textAlign: 'center', width: 80 }}>Qtd</th><th style={{ textAlign: 'right' }}>Unitário</th><th style={{ textAlign: 'right' }}>Subtotal</th><th style={{ width: 40 }}></th></tr>
                </thead>
                <tbody>
                  {itensPedido.map((item, idx) => (
                    <tr key={idx}>
                      <td><strong style={{ fontSize: 13 }}>{item.nome}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" min="1" step="1"
                          style={{ width: 60, padding: '4px 8px', border: '1.5px solid var(--borda)', borderRadius: 6, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13 }}
                          value={item.quantidade}
                          onChange={e => atualizarQtd(idx, e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--cinza-medio)' }}>{fmt(item.preco_unitario)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--azul)' }}>{fmt(item.quantidade * item.preco_unitario)}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => removerItem(idx)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="alert alert-blue" style={{ marginBottom: 14 }}>
            <span className="alert-icon">ℹ️</span>
            <div>Nenhum produto adicionado. Use o campo acima para adicionar itens à comanda.</div>
          </div>
        )}

        {/* Desconto e observações */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Desconto (R$)</label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00"
              value={formPedido.desconto}
              onChange={e => setFormPedido(f => ({ ...f, desconto: e.target.value }))} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observações</label>
            <input className="form-input" placeholder="Opcional..."
              value={formPedido.observacoes}
              onChange={e => setFormPedido(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>

        {/* Resumo de valores */}
        {itensPedido.length > 0 && (
          <div style={{ background: 'var(--azul-suave)', borderRadius: 10, padding: '12px 16px' }}>
            {(parseFloat(formPedido.desconto) > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--cinza-medio)', marginBottom: 4 }}>
                <span>Subtotal</span><span>{fmt(subAtual)}</span>
              </div>
            )}
            {(parseFloat(formPedido.desconto) > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--vermelho)', marginBottom: 4 }}>
                <span>Desconto</span><span>− {fmt(parseFloat(formPedido.desconto) || 0)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--azul)' }}>
              <span>Total</span><span>{fmt(totalAtual)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════
          Modal: QR Code Pix
      ══════════════════════════════════════ */}
      <Modal open={!!modalPix} onClose={() => setModalPix(null)}
        title="💳 Pagamento via Pix"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => imprimirQrCodePix(modalPix, PIX_CONFIG)}>🖨️ Imprimir QR</button>
            <button className="btn btn-ghost" onClick={() => gerarPdfPedidoLoja(modalPix, PIX_CONFIG)}>📄 PDF c/ Pix</button>
            {isCoord && <button className="btn btn-success" onClick={() => { setModalConfirmar(modalPix) }}>✅ Confirmar Pagamento</button>}
          </>
        }>
        {modalPix && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--azul)' }}>
                Pedido #{String(modalPix.numero).padStart(4, '0')}
              </span>
              {' — '}
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--cinza-medio)' }}>
                {modalPix.loja_clientes?.nome || modalPix.nome_avulso || 'Consumidor Final'}
              </span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--azul)', margin: '10px 0' }}>
              {fmt(modalPix.total)}
            </div>

            <p style={{ fontSize: 13, color: 'var(--cinza-medio)', marginBottom: 14 }}>
              Aponte a câmera do celular para realizar o pagamento
            </p>

            {/* QR Code */}
            <div style={{ display: 'inline-block', background: 'white', borderRadius: 12, padding: 14, boxShadow: 'var(--shadow-md)', marginBottom: 14 }}>
              <img src={pixQrUrl} alt="QR Code Pix" width={220} height={220}
                style={{ display: 'block', borderRadius: 6 }} />
            </div>

            {/* Chave */}
            <div style={{ background: 'var(--azul-suave)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, color: 'var(--azul)', fontWeight: 700, marginBottom: 12 }}>
              🔑 Chave Pix: {PIX_CONFIG.chave}
            </div>

            {/* Copia e Cola */}
            <button className="btn btn-ghost btn-sm"
              onClick={() => { navigator.clipboard.writeText(pixPayload); toast('Código Pix copiado!') }}>
              📋 Copiar código Pix (Copia e Cola)
            </button>
            <div style={{ fontSize: 9, color: 'var(--cinza)', wordBreak: 'break-all', marginTop: 8, padding: '0 4px', textAlign: 'left', background: 'var(--cinza-cl)', borderRadius: 6, padding: '6px 8px' }}>
              {pixPayload}
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════
          Modal: Confirmar Pagamento
      ══════════════════════════════════════ */}
      <Modal open={!!modalConfirmar} onClose={() => setModalConfirmar(null)}
        title="✅ Confirmar Pagamento"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalConfirmar(null)}>Voltar</button>
            <button className="btn btn-success" onClick={confirmarPagamento} disabled={saving}>
              {saving ? '⏳...' : '✅ Confirmar Recebimento'}
            </button>
          </>
        }>
        {modalConfirmar && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>💰</div>
            <p style={{ fontSize: 15, color: 'var(--texto)', marginBottom: 6 }}>
              Confirmar recebimento do pagamento via Pix?
            </p>
            <p style={{ fontSize: 13, color: 'var(--cinza-medio)', marginBottom: 6 }}>
              Pedido #{String(modalConfirmar.numero).padStart(4, '0')} —{' '}
              {modalConfirmar.loja_clientes?.nome || modalConfirmar.nome_avulso || 'Consumidor Final'}
            </p>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--verde)', margin: '12px 0' }}>
              {fmt(modalConfirmar.total)}
            </div>
            <div className="alert alert-blue" style={{ textAlign: 'left', marginTop: 14 }}>
              <span className="alert-icon">ℹ️</span>
              <div style={{ fontSize: 12.5 }}>
                O estoque será baixado automaticamente para cada item vendido.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
