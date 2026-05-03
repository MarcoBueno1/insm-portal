// src/lib/pdfLoja.js
// PDF da loja — mesmo padrão do pdf.js existente (abrirJanela + HTML)
// Usa jsPDF (já instalado: "jspdf": "^2.5.1") apenas para o QR Code como imagem
// O restante segue o padrão da lib: window.open + HTML + window.print()

import { gerarPixPayload, pixQrCodeUrl, gerarTxId } from './pix'

const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const estiloBase = `
body{font-family:Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:13px}
.header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}
.inst{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase}
h1{font-size:20px;color:#1a3a6b;margin:4px 0}
.sub{font-size:13px;color:#555;margin-top:4px}
.data{font-size:12px;color:#888;margin-top:4px}
.info-row{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.info-box{background:#f2f5fb;padding:10px 14px;border-radius:8px;font-size:12.5px;flex:1;min-width:130px}
.info-box strong{display:block;font-size:10px;color:#8a94a8;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px}
th{background:#1a3a6b;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.7px}
td{padding:8px 10px;border:1px solid #dce3f0}
tr.alt{background:#f8faff}
.total-row td{background:#1a3a6b;color:white;font-weight:800;font-size:14px}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
.footer{margin-top:22px;text-align:center;font-size:11px;color:#888}
h2{color:#1a3a6b;font-size:15px;margin:18px 0 8px;border-bottom:1px solid #dce3f0;padding-bottom:4px}
.pix-box{background:#f0f7ff;border:2px solid #1a3a6b;border-radius:12px;padding:20px;text-align:center;margin:20px 0}
.pix-box h2{border:none;margin:0 0 6px;font-size:17px}
.pix-box p{font-size:12.5px;color:#555;margin:4px 0}
.pix-chave{background:#1a3a6b;color:white;padding:6px 16px;border-radius:20px;display:inline-block;font-size:12px;font-weight:700;margin-top:10px}
.pix-valor{font-size:26px;font-weight:900;color:#1a3a6b;margin:8px 0}
.pix-img{margin:14px auto;display:block;border:2px solid #dce3f0;border-radius:10px;padding:8px;background:white}
@media print{button{display:none!important}}`

/**
 * Abre janela de impressão com o pedido completo e QR Code Pix
 * Mesmo padrão das outras funções em pdf.js
 *
 * @param {object} pedido   - pedido com loja_pedido_itens e loja_clientes
 * @param {object} pixConfig - { chave, nomeBeneficiario, cidadeBeneficiario }
 */
export function gerarPdfPedidoLoja(pedido, pixConfig) {
  const itens         = pedido.loja_pedido_itens || []
  const nomeCliente   = pedido.loja_clientes?.nome || pedido.nome_avulso || 'Consumidor Final'
  const numPedido     = `#${String(pedido.numero).padStart(4, '0')}`
  const dataFormatada = new Date(pedido.criado_em).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const statusMap = {
    aberto:     { label: 'Aberto',              cor: '#4a7fcb' },
    finalizado: { label: 'Aguard. Pagamento',   cor: '#d4680a' },
    pago:       { label: 'Pago',                cor: '#2e7d52' },
    cancelado:  { label: 'Cancelado',           cor: '#c0392b' },
  }
  const st = statusMap[pedido.status] || { label: pedido.status, cor: '#888' }

  const rowsItens = itens.map((item, i) => `
    <tr${i % 2 !== 0 ? ' class="alt"' : ''}>
      <td><strong>${item.produto_nome || item.loja_produtos?.nome || '—'}</strong></td>
      <td style="text-align:center">${item.quantidade}</td>
      <td style="text-align:right">${fmt(item.preco_unitario)}</td>
      <td style="text-align:right;font-weight:700;color:#1a3a6b">${fmt(item.subtotal)}</td>
    </tr>`).join('')

  // Gera QR Code Pix se aplicável
  let pixSection = ''
  if (pixConfig?.chave && pedido.status !== 'cancelado') {
    const payload = pedido.pix_payload || gerarPixPayload({
      chave:    pixConfig.chave,
      nome:     pixConfig.nomeBeneficiario || 'Instituto NSM',
      cidade:   pixConfig.cidadeBeneficiario || 'SAO PAULO',
      valor:    Number(pedido.total),
      txid:     gerarTxId(pedido.id),
      descricao: `Pedido ${numPedido} INSM`,
    })
    const qrUrl = pixQrCodeUrl(payload, 220)

    pixSection = `
    <div class="pix-box">
      <h2>💳 Pagamento via Pix</h2>
      <p>Aponte a câmera do celular para o QR Code abaixo</p>
      <div class="pix-valor">${fmt(pedido.total)}</div>
      <img class="pix-img" src="${qrUrl}" width="180" height="180" alt="QR Code Pix" />
      <div class="pix-chave">Chave Pix: ${pixConfig.chave}</div>
      <p style="margin-top:12px;font-size:11px;color:#888">Código copia e cola:</p>
      <div style="font-size:9px;color:#555;word-break:break-all;background:#f8faff;padding:8px;border-radius:6px;text-align:left;margin-top:4px">${payload}</div>
    </div>`
  }

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>Pedido ${numPedido} — INSM</title>
  <style>${estiloBase}</style></head><body>

  <div class="header">
    <div class="inst">Instituto Nossa Senhora Menina</div>
    <h1>🛒 Comprovante de Pedido ${numPedido}</h1>
    <div class="sub">Loja Solidária</div>
    <div class="data">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  </div>

  <div class="info-row">
    <div class="info-box">
      <strong>Cliente</strong>
      ${nomeCliente}
      ${pedido.loja_clientes?.telefone ? `<br><span style="font-size:11.5px;color:#888">📱 ${pedido.loja_clientes.telefone}</span>` : ''}
    </div>
    <div class="info-box">
      <strong>Data do Pedido</strong>
      ${dataFormatada}
    </div>
    <div class="info-box">
      <strong>Vendedor</strong>
      ${pedido.vendedor_nome || '—'}
    </div>
    <div class="info-box">
      <strong>Status</strong>
      <span style="font-weight:700;color:${st.cor}">${st.label}</span>
    </div>
  </div>

  <h2>Itens do Pedido</h2>
  <table>
    <thead>
      <tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unitário</th><th style="text-align:right">Subtotal</th></tr>
    </thead>
    <tbody>
      ${rowsItens}
    </tbody>
    <tfoot>
      ${pedido.desconto > 0 ? `
      <tr>
        <td colspan="3" style="text-align:right;font-weight:700;color:#888;padding:8px 10px">Subtotal</td>
        <td style="text-align:right;padding:8px 10px">${fmt(pedido.subtotal)}</td>
      </tr>
      <tr>
        <td colspan="3" style="text-align:right;font-weight:700;color:#c0392b;padding:8px 10px">Desconto</td>
        <td style="text-align:right;color:#c0392b;padding:8px 10px">− ${fmt(pedido.desconto)}</td>
      </tr>` : ''}
      <tr class="total-row">
        <td colspan="3" style="padding:10px">TOTAL</td>
        <td style="text-align:right;padding:10px">${fmt(pedido.total)}</td>
      </tr>
    </tfoot>
  </table>

  ${pedido.observacoes ? `<div style="background:#fdf8f1;border:1px solid #e8c547;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12.5px"><strong>Observações:</strong> ${pedido.observacoes}</div>` : ''}

  ${pixSection}

  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:14px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir / Salvar PDF</button>
  </div>

  </body></html>`

  const win = window.open('', '_blank', 'width=820,height=900')
  win.document.write(html)
  win.document.close()
}

/**
 * Abre janela de impressão com APENAS o QR Code Pix (para imprimir no celular ou computador)
 */
export function imprimirQrCodePix(pedido, pixConfig) {
  const numPedido = `#${String(pedido.numero).padStart(4, '0')}`
  const payload = pedido.pix_payload || gerarPixPayload({
    chave:    pixConfig.chave,
    nome:     pixConfig.nomeBeneficiario || 'Instituto NSM',
    cidade:   pixConfig.cidadeBeneficiario || 'SAO PAULO',
    valor:    Number(pedido.total),
    txid:     gerarTxId(pedido.id),
    descricao: `Pedido ${numPedido} INSM`,
  })
  const qrUrl = pixQrCodeUrl(payload, 280)

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
  <title>QR Code Pix — Pedido ${numPedido}</title>
  <style>
    body{font-family:Arial,sans-serif;text-align:center;padding:30px;background:#fff;max-width:360px;margin:0 auto}
    h2{color:#1a3a6b;font-size:18px;margin-bottom:4px}
    .sub{font-size:12.5px;color:#888;margin-bottom:6px}
    .valor{font-size:28px;font-weight:900;color:#2e7d52;margin:10px 0}
    img{border:2px solid #dce3f0;border-radius:10px;padding:10px;background:white;display:block;margin:12px auto}
    .chave{background:#f2f5fb;padding:8px 16px;border-radius:20px;font-size:12.5px;color:#1a3a6b;font-weight:700;display:inline-block;margin-top:10px}
    .obs{font-size:11.5px;color:#888;margin-top:14px}
    .payload{font-size:9px;color:#aaa;word-break:break-all;padding:8px;background:#f8faff;border-radius:6px;margin-top:8px;text-align:left}
    @media print{button{display:none!important}}
  </style></head><body>
    <h2>Instituto Nossa Senhora Menina</h2>
    <div class="sub">Pedido ${numPedido}</div>
    <div class="valor">${fmt(pedido.total)}</div>
    <img src="${qrUrl}" width="240" height="240" alt="QR Code Pix" />
    <div class="chave">Chave Pix: ${pixConfig.chave}</div>
    <div class="obs">Após o pagamento, informe ao vendedor para confirmação.</div>
    <div class="payload">${payload}</div>
    <br>
    <button onclick="window.print()" style="padding:10px 24px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir QR Code</button>
  </body></html>`

  const win = window.open('', '_blank', 'width=420,height=680')
  win.document.write(html)
  win.document.close()
}
