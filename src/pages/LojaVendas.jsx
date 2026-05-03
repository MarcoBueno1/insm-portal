import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'
import { gerarPdfPedidoLoja } from '../lib/pdfLoja'

const PIX_CONFIG = {
  chave:              import.meta.env.VITE_PIX_CHAVE    || 'CONFIGURE_VITE_PIX_CHAVE',
  nomeBeneficiario:   import.meta.env.VITE_PIX_NOME     || 'Instituto NSM',
  cidadeBeneficiario: import.meta.env.VITE_PIX_CIDADE   || 'SAO PAULO',
}

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function LojaVendas() {
  const toast = useToast()

  const [vendas, setVendas]           = useState([])   // pedidos com status=pago
  const [loading, setLoading]         = useState(true)
  const [busca, setBusca]             = useState('')
  const [periodoInicio, setInicio]    = useState('')
  const [periodoFim, setFim]          = useState('')
  const [expandido, setExpandido]     = useState(null)  // id do pedido expandido

  useEffect(() => { load() }, [periodoInicio, periodoFim])

  async function load() {
    setLoading(true)
    let query = supabase
      .from('loja_pedidos')
      .select('*, loja_clientes(id,nome,telefone), loja_pedido_itens(id,produto_id,produto_nome,quantidade,preco_unitario,subtotal)')
      .eq('status', 'pago')
      .order('pix_confirmado_em', { ascending: false })

    if (periodoInicio) query = query.gte('pix_confirmado_em', periodoInicio)
    if (periodoFim)    query = query.lte('pix_confirmado_em', periodoFim + 'T23:59:59')

    const { data } = await query
    setVendas(data || [])
    setLoading(false)
  }

  const vendasFiltradas = vendas.filter(v => {
    const nomeCliente = v.loja_clientes?.nome || v.nome_avulso || ''
    return String(v.numero).includes(busca) ||
      nomeCliente.toLowerCase().includes(busca.toLowerCase())
  })

  // Métricas
  const totalGeral   = vendasFiltradas.reduce((s, v) => s + Number(v.total), 0)
  const ticketMedio  = vendasFiltradas.length ? totalGeral / vendasFiltradas.length : 0
  const totalItens   = vendasFiltradas.reduce((s, v) =>
    s + (v.loja_pedido_itens || []).reduce((ss, i) => ss + Number(i.quantidade), 0), 0)

  // Ranking de produtos
  const ranking = (() => {
    const mapa = {}
    vendasFiltradas.forEach(v => {
      ;(v.loja_pedido_itens || []).forEach(i => {
        const n = i.produto_nome || '—'
        if (!mapa[n]) mapa[n] = { nome: n, quantidade: 0, total: 0 }
        mapa[n].quantidade += Number(i.quantidade)
        mapa[n].total      += Number(i.subtotal)
      })
    })
    return Object.values(mapa).sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
  })()

  // Relatório PDF geral
  function gerarRelatorio() {
    const estiloBase = `
body{font-family:Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:13px}
.header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}
.inst{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase}
h1{font-size:20px;color:#1a3a6b;margin:4px 0}
.sub{font-size:13px;color:#555;margin-top:4px}
.data{font-size:12px;color:#888;margin-top:4px}
.resumo{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.res{background:#f2f5fb;padding:10px 14px;border-radius:8px;font-size:13px;min-width:130px}
.res strong{color:#1a3a6b;font-size:20px;display:block}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px}
th{background:#1a3a6b;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.7px}
td{padding:8px 10px;border:1px solid #dce3f0}
h2{color:#1a3a6b;font-size:15px;margin:18px 0 8px;border-bottom:1px solid #dce3f0;padding-bottom:4px}
.footer{margin-top:22px;text-align:center;font-size:11px;color:#888}
@media print{button{display:none!important}}`

    const rowsVendas = vendasFiltradas.map((v, i) => {
      const nomeCliente = v.loja_clientes?.nome || v.nome_avulso || 'Consumidor Final'
      const dataConf = v.pix_confirmado_em
        ? new Date(v.pix_confirmado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—'
      return `<tr style="background:${i % 2 === 0 ? '#f8faff' : 'white'}">
        <td>#${String(v.numero).padStart(4, '0')}</td>
        <td>${nomeCliente}</td>
        <td>${dataConf}</td>
        <td style="text-align:center">${(v.loja_pedido_itens || []).length}</td>
        <td style="text-align:right;font-weight:700;color:#2e7d52">${fmt(v.total)}</td>
        <td>${v.vendedor_nome || '—'}</td>
      </tr>`
    }).join('')

    const rowsRanking = ranking.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? '#f8faff' : 'white'}">
        <td style="text-align:center;font-weight:800;color:#1a3a6b">${i + 1}º</td>
        <td><strong>${p.nome}</strong></td>
        <td style="text-align:center">${p.quantidade}</td>
        <td style="text-align:right;font-weight:700;color:#2e7d52">${fmt(p.total)}</td>
      </tr>`).join('')

    const periodoLabel = periodoInicio || periodoFim
      ? `${periodoInicio ? new Date(periodoInicio + 'T00:00:00').toLocaleDateString('pt-BR') : 'início'} até ${periodoFim ? new Date(periodoFim + 'T00:00:00').toLocaleDateString('pt-BR') : 'hoje'}`
      : 'Período completo'

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório de Vendas — INSM</title>
<style>${estiloBase}</style></head><body>
<div class="header">
  <div class="inst">Instituto Nossa Senhora Menina</div>
  <h1>💰 Relatório de Vendas da Loja</h1>
  <div class="sub">${periodoLabel}</div>
  <div class="data">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</div>

<div class="resumo">
  <div class="res"><strong>${vendasFiltradas.length}</strong>Vendas</div>
  <div class="res"><strong style="color:#2e7d52">${fmt(totalGeral)}</strong>Total arrecadado</div>
  <div class="res"><strong style="color:#1a3a6b">${fmt(ticketMedio)}</strong>Ticket médio</div>
  <div class="res"><strong>${totalItens}</strong>Itens vendidos</div>
</div>

${ranking.length > 0 ? `
<h2>🏆 Top Produtos Mais Vendidos</h2>
<table>
  <thead><tr><th>#</th><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${rowsRanking}</tbody>
</table>` : ''}

<h2>📋 Detalhamento das Vendas</h2>
<table>
  <thead><tr><th>Pedido</th><th>Cliente</th><th>Data Confirmação</th><th style="text-align:center">Itens</th><th style="text-align:right">Total</th><th>Vendedor</th></tr></thead>
  <tbody>${rowsVendas}</tbody>
  <tfoot>
    <tr style="background:#1a3a6b;color:white">
      <td colspan="4" style="font-weight:700;padding:10px">TOTAL GERAL</td>
      <td style="text-align:right;font-weight:800;font-size:14px;padding:10px">${fmt(totalGeral)}</td>
      <td></td>
    </tr>
  </tfoot>
</table>

<div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
<div style="text-align:center;margin-top:14px">
  <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir / Salvar PDF</button>
</div>
</body></html>`

    const win = window.open('', '_blank', 'width=1000,height=740')
    win.document.write(html)
    win.document.close()
    toast('Relatório gerado!')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 Histórico de Vendas</h1>
          <p className="page-subtitle">Vendas confirmadas da loja solidária</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={gerarRelatorio}>📄 Relatório PDF</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Carregando...</span></div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }} className="stat-grid-4">
            <div className="stat-card blue">
              <span className="stat-icon">🧾</span>
              <div className="stat-value">{vendasFiltradas.length}</div>
              <div className="stat-label">Vendas no período</div>
            </div>
            <div className="stat-card green">
              <span className="stat-icon">💰</span>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(totalGeral)}</div>
              <div className="stat-label">Total arrecadado</div>
            </div>
            <div className="stat-card gold">
              <span className="stat-icon">🎯</span>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(ticketMedio)}</div>
              <div className="stat-label">Ticket médio</div>
            </div>
            <div className="stat-card orange">
              <span className="stat-icon">📦</span>
              <div className="stat-value">{totalItens}</div>
              <div className="stat-label">Itens vendidos</div>
            </div>
          </div>

          {/* Ranking */}
          {ranking.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-header">
                <span className="card-title">🏆 Top Produtos Mais Vendidos</span>
              </div>
              <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {ranking.map((p, i) => (
                  <div key={p.nome} style={{
                    flex: '1 1 140px',
                    background: i === 0 ? 'linear-gradient(135deg,var(--azul-medio),var(--azul))' : 'var(--cinza-cl)',
                    color: i === 0 ? 'white' : 'var(--texto)',
                    borderRadius: 10, padding: '10px 14px',
                  }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, opacity: .75, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{i + 1}º lugar</div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{p.nome}</div>
                    <div style={{ fontSize: 12 }}>{p.quantidade} un · {fmt(p.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-wrap" style={{ flex: 1, minWidth: 180 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Buscar por nº ou cliente..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'var(--cinza)', whiteSpace: 'nowrap' }}>De:</span>
              <input type="date" className="form-input" style={{ width: 145 }} value={periodoInicio} onChange={e => setInicio(e.target.value)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12.5, color: 'var(--cinza)', whiteSpace: 'nowrap' }}>Até:</span>
              <input type="date" className="form-input" style={{ width: 145 }} value={periodoFim} onChange={e => setFim(e.target.value)} />
            </div>
            {(periodoInicio || periodoFim) && (
              <button className="btn btn-sm btn-ghost" onClick={() => { setInicio(''); setFim('') }}>✕ Limpar</button>
            )}
          </div>

          {/* Tabela de vendas */}
          {vendasFiltradas.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💰</span>
              <h3>Nenhuma venda encontrada</h3>
              <p>As vendas aparecem aqui após a confirmação do pagamento nas Comandas.</p>
            </div>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Data da Venda</th>
                      <th>Vendedor</th>
                      <th style={{ textAlign: 'center' }}>Itens</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasFiltradas.map(v => {
                      const nomeCliente = v.loja_clientes?.nome || v.nome_avulso || 'Consumidor Final'
                      const dataConf = v.pix_confirmado_em
                        ? new Date(v.pix_confirmado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : new Date(v.atualizado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      return (
                        <>
                          <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setExpandido(expandido === v.id ? null : v.id)}>
                            <td>
                              <strong style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--azul)' }}>
                                #{String(v.numero).padStart(4, '0')}
                              </strong>
                            </td>
                            <td>{nomeCliente}</td>
                            <td style={{ fontSize: 12.5, color: 'var(--cinza-medio)' }}>{dataConf}</td>
                            <td style={{ fontSize: 12.5 }}>{v.vendedor_nome || '—'}</td>
                            <td style={{ textAlign: 'center' }}>{(v.loja_pedido_itens || []).length}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--verde)', fontFamily: 'var(--font-display)', fontSize: 15 }}>{fmt(v.total)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button className="btn btn-sm btn-ghost"
                                  onClick={e => { e.stopPropagation(); setExpandido(expandido === v.id ? null : v.id) }}>
                                  {expandido === v.id ? '▲' : '▼'} Detalhes
                                </button>
                                <button className="btn btn-sm btn-outline"
                                  onClick={e => { e.stopPropagation(); gerarPdfPedidoLoja(v, PIX_CONFIG) }}>
                                  📄 PDF
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expandido === v.id && (
                            <tr key={v.id + '_det'}>
                              <td colSpan="7" style={{ padding: 0, background: 'var(--creme)' }}>
                                <div style={{ padding: '12px 18px' }}>
                                  <table style={{ marginBottom: 0 }}>
                                    <thead>
                                      <tr>
                                        <th>Produto</th>
                                        <th style={{ textAlign: 'center' }}>Qtd</th>
                                        <th style={{ textAlign: 'right' }}>Unitário</th>
                                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(v.loja_pedido_itens || []).map(i => (
                                        <tr key={i.id}>
                                          <td>{i.produto_nome}</td>
                                          <td style={{ textAlign: 'center' }}>{i.quantidade}</td>
                                          <td style={{ textAlign: 'right', color: 'var(--cinza-medio)' }}>{fmt(i.preco_unitario)}</td>
                                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(i.subtotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {v.observacoes && (
                                    <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--cinza-medio)' }}>
                                      <strong>Obs:</strong> {v.observacoes}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
