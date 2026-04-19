// Utilitários para geração de PDF sem dependências externas
// Usa a API de impressão do navegador com janela estilizada

export function gerarListaPresencaPDF(atividade) {
  const totalParticipantes = (atividade.qtd_criancas || 0) + (atividade.qtd_adultos || 0)
  const linhas = Array.from({ length: Math.max(totalParticipantes, 10) }, (_, i) => {
    const tipo = i < (atividade.qtd_criancas || 0) ? 'Criança' : i < totalParticipantes ? 'Adulto' : ''
    return `<tr>
      <td style="width:36px;text-align:center;color:#888">${i + 1}</td>
      <td></td>
      <td style="width:70px;text-align:center;font-size:11px;color:#666">${tipo}</td>
      <td style="height:38px"></td>
    </tr>`
  }).join('')

  const dataFormatada = atividade.data
    ? new Date(atividade.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Lista de Presença — ${atividade.titulo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Nunito', Arial, sans-serif; padding: 32px; color: #1e2a3a; }
    .header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #c9a227; }
    .header .estrela { font-size: 28px; display: block; margin-bottom: 6px; }
    .header h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; color: #1a3a6b; margin-bottom: 4px; }
    .header .instituto { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #c9a227; font-weight: 700; }
    .atividade-info { background: #f2f5fb; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px; }
    .atividade-info h2 { font-family: 'Cormorant Garamond', serif; font-size: 18px; color: #1a3a6b; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px; color: #555; }
    .info-item strong { color: #1a3a6b; font-weight: 700; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 20px; }
    th { background: #1a3a6b; color: white; padding: 9px 12px; text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.8px; }
    td { padding: 0 12px; border: 1px solid #dce3f0; }
    tr:nth-child(even) { background: #f8faff; }
    .totais { display: flex; gap: 20px; font-size: 12px; margin-bottom: 28px; }
    .total-item { background: #e8eef8; padding: 8px 16px; border-radius: 8px; }
    .total-item strong { color: #1a3a6b; }
    .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 11px; color: #888; padding-top: 14px; border-top: 1px solid #dce3f0; }
    .assinatura-responsavel { margin-top: 40px; text-align: center; }
    .linha-assinatura { width: 280px; height: 1px; background: #333; margin: 0 auto 6px; }
    @media print {
      body { padding: 20px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="estrela">✦</span>
    <div class="instituto">Instituto Nossa Senhora Menina</div>
    <h1>Lista de Presença</h1>
  </div>

  <div class="atividade-info">
    <h2>${atividade.titulo}</h2>
    <div class="info-grid">
      <div class="info-item"><strong>Data</strong>${dataFormatada}</div>
      <div class="info-item"><strong>Local</strong>${atividade.local || '—'}</div>
      <div class="info-item"><strong>Tema</strong>${atividade.tema || '—'}</div>
    </div>
  </div>

  <div class="totais">
    <div class="total-item">👧 <strong>${atividade.qtd_criancas || 0}</strong> crianças previstas</div>
    <div class="total-item">👨 <strong>${atividade.qtd_adultos || 0}</strong> adultos previstos</div>
    <div class="total-item">👥 <strong>${totalParticipantes}</strong> total previsto</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Nome Completo</th>
        <th>Tipo</th>
        <th>Assinatura</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="assinatura-responsavel">
    <div class="linha-assinatura"></div>
    <div style="font-size:11px;color:#666">Assinatura do Responsável pela Atividade</div>
  </div>

  <div class="footer">
    <span>✦ Instituto Nossa Senhora Menina</span>
    <span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
  </div>

  <div style="text-align:center;margin-top:20px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-family:Nunito,sans-serif;font-weight:700">
      🖨️ Imprimir Lista
    </button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
}

export function gerarRelatorioEstoquePDF(itens) {
  const rows = itens.map((e, i) => {
    const status = e.qtd_atual <= 0 ? '🔴 Crítico' : e.qtd_atual <= e.qtd_minima ? '⚠️ Baixo' : '✅ OK'
    const cor = e.qtd_atual <= 0 ? '#fdf0ee' : e.qtd_atual <= e.qtd_minima ? '#fef3e8' : '#eaf5ee'
    return `<tr style="background:${i % 2 === 0 ? '#f8faff' : 'white'}">
      <td>${e.produto}</td>
      <td>${e.categoria || '—'}</td>
      <td style="text-align:center;font-weight:700">${e.qtd_atual}</td>
      <td style="text-align:center">${e.qtd_minima}</td>
      <td style="text-align:center">${e.unidade || 'un'}</td>
      <td style="text-align:center;background:${cor};font-size:12px">${status}</td>
    </tr>`
  }).join('')

  const criticos = itens.filter(e => e.qtd_atual <= 0).length
  const baixos = itens.filter(e => e.qtd_atual > 0 && e.qtd_atual <= e.qtd_minima).length

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Estoque — Instituto NSM</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #1e2a3a; }
    .header { text-align:center; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #c9a227; }
    h1 { font-size:20px; color:#1a3a6b; margin:4px 0; }
    .sub { font-size:11px; color:#888; letter-spacing:1px; text-transform:uppercase; }
    .resumo { display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
    .res-item { background:#f2f5fb; padding:10px 16px; border-radius:8px; font-size:13px; }
    .res-item strong { color:#1a3a6b; font-size:18px; display:block; }
    table { width:100%; border-collapse:collapse; font-size:12.5px; }
    th { background:#1a3a6b; color:white; padding:9px 12px; text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:0.8px; }
    td { padding:9px 12px; border:1px solid #dce3f0; }
    .footer { margin-top:24px; text-align:center; font-size:11px; color:#888; }
    @media print { button { display:none!important } }
  </style>
</head>
<body>
  <div class="header">
    <div class="sub">Instituto Nossa Senhora Menina</div>
    <h1>Relatório de Estoque</h1>
    <div style="font-size:12px;color:#888;margin-top:4px">Gerado em ${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div>
  </div>
  <div class="resumo">
    <div class="res-item"><strong>${itens.length}</strong>Total de itens</div>
    <div class="res-item"><strong style="color:#2e7d52">${itens.length - criticos - baixos}</strong>Itens OK</div>
    <div class="res-item"><strong style="color:#d4680a">${baixos}</strong>Estoque Baixo</div>
    <div class="res-item"><strong style="color:#c0392b">${criticos}</strong>Estoque Crítico</div>
  </div>
  <table>
    <thead><tr><th>Produto</th><th>Categoria</th><th>Qtd Atual</th><th>Qtd Mínima</th><th>Unidade</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ Imprimir Relatório</button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
}

export function gerarRelatorioComprasPDF(compras, titulo = 'Relatório de Compras') {
  const total = compras.reduce((s, c) => s + (Number(c.valor_total) || 0), 0)

  const rows = compras.map((c, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8faff' : 'white'}">
      <td>${c.data ? new Date(c.data + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td>${c.item}</td>
      <td>${c.categoria || '—'}</td>
      <td style="text-align:center">${c.quantidade}</td>
      <td style="text-align:right">R$ ${Number(c.valor_unitario || 0).toFixed(2)}</td>
      <td style="text-align:right;font-weight:700">R$ ${Number(c.valor_total || 0).toFixed(2)}</td>
      <td>${c.atividade_nome || 'Geral'}</td>
      <td>${c.responsavel || '—'}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo} — Instituto NSM</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #1e2a3a; font-size: 12px; }
    .header { text-align:center; margin-bottom:22px; padding-bottom:14px; border-bottom:2px solid #c9a227; }
    h1 { font-size:19px; color:#1a3a6b; }
    table { width:100%; border-collapse:collapse; font-size:11.5px; }
    th { background:#1a3a6b; color:white; padding:8px 10px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.6px; }
    td { padding:8px 10px; border:1px solid #dce3f0; }
    .total-row { background:#e8eef8!important; font-weight:700; }
    .footer { margin-top:20px; text-align:center; font-size:11px; color:#888; }
    @media print { button { display:none!important } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:10px;color:#888;letter-spacing:1.5px;text-transform:uppercase">Instituto Nossa Senhora Menina</div>
    <h1>${titulo}</h1>
    <div style="font-size:11px;color:#888;margin-top:4px">Gerado em ${new Date().toLocaleDateString('pt-BR')} · ${compras.length} registros · Total: R$ ${total.toFixed(2)}</div>
  </div>
  <table>
    <thead><tr><th>Data</th><th>Item</th><th>Categoria</th><th>Qtd</th><th>Vlr Unit</th><th>Total</th><th>Atividade</th><th>Responsável</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5" style="text-align:right">TOTAL GERAL</td>
        <td>R$ ${total.toFixed(2)}</td>
        <td colspan="2"></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:14px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir Relatório</button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=700')
  win.document.write(html)
  win.document.close()
}

export function formatarData(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

export function abrirGoogleCalendar(atividade) {
  const data = atividade.data?.replace(/-/g, '') || ''
  const inicio = data + (atividade.hora_inicio ? 'T' + atividade.hora_inicio.replace(/:/g, '') + '00' : '')
  const fim = data + (atividade.hora_fim ? 'T' + atividade.hora_fim.replace(/:/g, '') + '00' : '')
  const details = encodeURIComponent(
    `${atividade.descricao || ''}\n\nCrianças: ${atividade.qtd_criancas || 0} | Adultos: ${atividade.qtd_adultos || 0}\nInsumos: ${atividade.insumos || '—'}`
  )
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(atividade.titulo)}&dates=${inicio}/${fim}&location=${encodeURIComponent(atividade.local || '')}&details=${details}`
  window.open(url, '_blank')
}
