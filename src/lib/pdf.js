// ── Utilitários de PDF / impressão ──────────────────────────────

export function gerarListaPresencaPDF(atividade, participantesSelecionados = []) {
  const totalParticipantes = (atividade.qtd_criancas || 0) + (atividade.qtd_adultos || 0)
  const dataFormatada = atividade.data
    ? new Date(atividade.data + 'T12:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })
    : ''

  const criancasSel = participantesSelecionados.filter(p => p.tipo === 'crianca')
  const adultosSel  = participantesSelecionados.filter(p => p.tipo === 'adulto')

  const qtdCriancas = Math.max(criancasSel.length, atividade.qtd_criancas || 0)
  const qtdAdultos  = Math.max(adultosSel.length,  atividade.qtd_adultos  || 0)

  const linhasCriancas = Array.from({ length: qtdCriancas }, (_, i) => {
    const p = criancasSel[i]
    return `<tr>
      <td style="text-align:center;color:#888;width:28px;font-size:11px">${i + 1}</td>
      <td style="padding:0 8px;min-width:160px">${p ? `<strong>${p.nome}</strong>` : ''}</td>
      <td style="text-align:center;width:50px;font-weight:700;color:#1a3a6b">${p?.idade ? p.idade : ''}</td>
      <td style="height:34px;width:100px"></td>
      <td style="font-size:11px;color:#666;width:120px">${p?.nome_responsavel ? `${p.nome_responsavel}${p.parentesco ? ' ('+p.parentesco+')' : ''}` : ''}</td>
    </tr>`
  }).join('')

  const linhasAdultos = Array.from({ length: qtdAdultos }, (_, i) => {
    const p = adultosSel[i]
    return `<tr>
      <td style="text-align:center;color:#888;width:28px;font-size:11px">${i + 1}</td>
      <td style="padding:0 8px;min-width:180px">${p ? `<strong>${p.nome}</strong>` : ''}</td>
      <td style="height:34px;width:120px"></td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lista de Presença — ${atividade.titulo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Nunito',Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:12.5px}
    .header{text-align:center;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #c9a227}
    .header h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#1a3a6b;margin:5px 0 2px}
    .header .sub{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;font-weight:700}
    .info{background:#f2f5fb;border-radius:8px;padding:10px 14px;margin-bottom:14px}
    .info h2{font-family:'Cormorant Garamond',serif;font-size:17px;color:#1a3a6b;margin-bottom:5px}
    .info-row{display:flex;gap:20px;font-size:11.5px;color:#555;flex-wrap:wrap}
    .totais{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
    .total-box{background:#e8eef8;padding:6px 12px;border-radius:6px;font-size:11.5px}
    .total-box strong{color:#1a3a6b;font-size:15px;display:block}
    h3{font-size:12px;font-weight:800;color:#1a3a6b;text-transform:uppercase;letter-spacing:.8px;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #dce3f0}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px}
    th{background:#1a3a6b;color:white;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.7px}
    td{padding:0 10px;border:1px solid #dce3f0}
    tr:nth-child(even) td{background:#f8faff}
    .assinatura{margin-top:24px;display:flex;justify-content:space-between;gap:20px}
    .assin-box{text-align:center;flex:1}
    .assin-linha{height:1px;background:#555;margin:0 auto 5px}
    .footer{margin-top:18px;text-align:center;font-size:10px;color:#888;border-top:1px solid #dce3f0;padding-top:10px}
    @media print{button{display:none!important}body{padding:14px}}
  </style>
</head>
<body>
  <div class="header">
    <div class="sub">Instituto Nossa Senhora Menina</div>
    <h1>Lista de Presença</h1>
  </div>
  <div class="info">
    <h2>${atividade.titulo}</h2>
    <div class="info-row">
      <span>📅 ${dataFormatada}</span>
      ${atividade.local ? `<span>📍 ${atividade.local}</span>` : ''}
      ${atividade.tema  ? `<span>🎯 ${atividade.tema}</span>` : ''}
      ${atividade.hora_inicio ? `<span>⏰ ${atividade.hora_inicio}${atividade.hora_fim ? ' – '+atividade.hora_fim : ''}</span>` : ''}
    </div>
  </div>
  <div class="totais">
    <div class="total-box"><strong>${qtdCriancas}</strong>crianças previstas</div>
    <div class="total-box"><strong>${qtdAdultos}</strong>adultos previstos</div>
    <div class="total-box"><strong>${qtdCriancas + qtdAdultos}</strong>total previsto</div>
    ${participantesSelecionados.length > 0 ? `<div class="total-box" style="background:#eaf5ee"><strong style="color:#2e7d52">${participantesSelecionados.length}</strong>com nome pré-preenchido</div>` : ''}
  </div>

  ${qtdCriancas > 0 ? `
  <h3>👧 Crianças</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Nome Completo</th>
        <th style="text-align:center">Idade</th>
        <th>Assinatura</th>
        <th>Responsável</th>
      </tr>
    </thead>
    <tbody>${linhasCriancas}</tbody>
  </table>` : ''}

  ${qtdAdultos > 0 ? `
  <h3>👨 Adultos</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Nome Completo</th>
        <th>Assinatura</th>
      </tr>
    </thead>
    <tbody>${linhasAdultos}</tbody>
  </table>` : ''}

  <div class="assinatura">
    <div class="assin-box">
      <div class="assin-linha" style="width:80%"></div>
      <div style="font-size:11px;color:#666">Responsável pela Atividade</div>
    </div>
    <div class="assin-box">
      <div class="assin-linha" style="width:80%"></div>
      <div style="font-size:11px;color:#666">Coordenação</div>
    </div>
  </div>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  <div style="text-align:center;margin-top:12px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:Nunito,sans-serif;font-weight:700">
      🖨️ Imprimir Lista de Presença
    </button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=750')
  win.document.write(html)
  win.document.close()
}

export function gerarRelatorioEstoquePDF(itens) {
  const rows = itens.map((e, i) => {
    const status = e.qtd_atual <= 0 ? '🔴 Crítico' : e.qtd_atual <= e.qtd_minima ? '⚠️ Baixo' : '✅ OK'
    const cor    = e.qtd_atual <= 0 ? '#fdf0ee'    : e.qtd_atual <= e.qtd_minima ? '#fef3e8'   : '#eaf5ee'
    return `<tr style="background:${i%2===0?'#f8faff':'white'}">
      <td>${e.produto}</td>
      <td>${e.categoria||'—'}</td>
      <td style="text-align:center;font-weight:700">${e.qtd_atual}</td>
      <td style="text-align:center">${e.qtd_minima}</td>
      <td style="text-align:center">${e.unidade||'un'}</td>
      <td style="text-align:center;background:${cor};font-size:12px">${status}</td>
    </tr>`
  }).join('')

  const criticos = itens.filter(e => e.qtd_atual <= 0).length
  const baixos   = itens.filter(e => e.qtd_atual > 0 && e.qtd_atual <= e.qtd_minima).length

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Estoque</title>
  <style>body{font-family:Arial,sans-serif;padding:28px;color:#1e2a3a}.header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}h1{font-size:20px;color:#1a3a6b;margin:4px 0}.resumo{display:flex;gap:14px;margin-bottom:18px;flex-wrap:wrap}.res{background:#f2f5fb;padding:10px 14px;border-radius:8px;font-size:13px;min-width:120px}.res strong{color:#1a3a6b;font-size:18px;display:block}table{width:100%;border-collapse:collapse;font-size:12.5px}th{background:#1a3a6b;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.7px}td{padding:8px 10px;border:1px solid #dce3f0}.footer{margin-top:22px;text-align:center;font-size:11px;color:#888}@media print{button{display:none!important}}</style></head>
  <body>
  <div class="header"><div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase">Instituto Nossa Senhora Menina</div><h1>Relatório de Estoque</h1><div style="font-size:12px;color:#888;margin-top:4px">Gerado em ${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div></div>
  <div class="resumo">
    <div class="res"><strong>${itens.length}</strong>Total de itens</div>
    <div class="res"><strong style="color:#2e7d52">${itens.length-criticos-baixos}</strong>Itens OK</div>
    <div class="res"><strong style="color:#d4680a">${baixos}</strong>Estoque Baixo</div>
    <div class="res"><strong style="color:#c0392b">${criticos}</strong>Estoque Crítico</div>
  </div>
  <table><thead><tr><th>Produto</th><th>Categoria</th><th>Qtd Atual</th><th>Qtd Mínima</th><th>Unidade</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:14px"><button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir Relatório</button></div>
  </body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html); win.document.close()
}

export function gerarRelatorioComprasPDF(compras, titulo = 'Relatório de Compras') {
  const total = compras.reduce((s, c) => s + (Number(c.valor_total) || 0), 0)
  const rows  = compras.map((c, i) => `
    <tr style="background:${i%2===0?'#f8faff':'white'}">
      <td>${c.data ? new Date(c.data+'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td>${c.item}</td>
      <td>${c.categoria||'—'}</td>
      <td style="text-align:center">${c.quantidade}</td>
      <td style="text-align:right">R$ ${Number(c.valor_unitario||0).toFixed(2)}</td>
      <td style="text-align:right;font-weight:700">R$ ${Number(c.valor_total||0).toFixed(2)}</td>
      <td>${c.atividade_nome||'—'}</td>
      <td>${c.usuario_nome||c.responsavel||'—'}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
  <style>body{font-family:Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:12px}.header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}h1{font-size:19px;color:#1a3a6b}table{width:100%;border-collapse:collapse;font-size:11.5px}th{background:#1a3a6b;color:white;padding:7px 9px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px}td{padding:7px 9px;border:1px solid #dce3f0}.total-row{background:#e8eef8!important;font-weight:700}.footer{margin-top:18px;text-align:center;font-size:11px;color:#888}@media print{button{display:none!important}}</style></head>
  <body>
  <div class="header"><div style="font-size:10px;color:#888;letter-spacing:1.5px;text-transform:uppercase">Instituto Nossa Senhora Menina</div><h1>${titulo}</h1><div style="font-size:11px;color:#888;margin-top:4px">Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${compras.length} registros · Total: R$ ${total.toFixed(2)}</div></div>
  <table><thead><tr><th>Data</th><th>Item</th><th>Categoria</th><th>Qtd</th><th>Vlr Unit</th><th>Total</th><th>Atividade</th><th>Registrado por</th></tr></thead>
  <tbody>${rows}<tr class="total-row"><td colspan="5" style="text-align:right">TOTAL GERAL</td><td>R$ ${total.toFixed(2)}</td><td colspan="2"></td></tr></tbody></table>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir Relatório</button></div>
  </body></html>`

  const win = window.open('', '_blank', 'width=1000,height=700')
  win.document.write(html); win.document.close()
}

export function formatarData(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T12:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' })
  } catch { return dateStr }
}

export function abrirGoogleCalendar(atividade) {
  const data  = atividade.data?.replace(/-/g,'') || ''
  const ini   = data + (atividade.hora_inicio ? 'T' + atividade.hora_inicio.replace(/:/g,'') + '00' : '')
  const fim   = data + (atividade.hora_fim    ? 'T' + atividade.hora_fim.replace(/:/g,'')    + '00' : '')
  const det   = encodeURIComponent(`${atividade.descricao||''}\n\nCrianças: ${atividade.qtd_criancas||0} | Adultos: ${atividade.qtd_adultos||0}\nInsumos: ${atividade.insumos||'—'}`)
  const url   = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(atividade.titulo)}&dates=${ini}/${fim}&location=${encodeURIComponent(atividade.local||'')}&details=${det}`
  window.open(url, '_blank')
}
