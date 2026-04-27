// ============================================================
// Instituto Nossa Senhora Menina — PDF Generator
// ============================================================

// ── helpers ──────────────────────────────────────────────────

function abrirJanela(html, titulo='Relatório') {
  const win = window.open('', '_blank', 'width=1000,height=740')
  win.document.write(html)
  win.document.close()
}

const cabecalho = (titulo, subtitulo='') => `
<div class="header">
  <div class="inst">Instituto Nossa Senhora Menina</div>
  <h1>${titulo}</h1>
  ${subtitulo ? `<div class="sub">${subtitulo}</div>` : ''}
  <div class="data">Gerado em ${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div>
</div>`

const rodape = () => `
<div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
<div style="text-align:center;margin-top:14px">
  <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px">🖨️ Imprimir</button>
</div>`

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
.footer{margin-top:22px;text-align:center;font-size:11px;color:#888}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
h2{color:#1a3a6b;font-size:16px;margin:20px 0 8px;border-bottom:1px solid #dce3f0;padding-bottom:4px}
@media print{button{display:none!important}}`

const fmt = v => Number(v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })

// ── 1. Lista de Presença ─────────────────────────────────────

export function gerarListaPresencaPDF(atividade, participantesSelecionados=[]) {
  const criancas = participantesSelecionados.filter(p=>p.tipo==='crianca')
  const adultos = participantesSelecionados.filter(p=>p.tipo==='adulto')

  const linhas = (lista) => lista.map((p,i) => `
    <tr style="background:${i%2===0?'#f8faff':'white'}">
      <td style="width:32px;text-align:center">${i+1}</td>
      <td>${p.nome}</td>
      <td style="width:80px"></td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Lista de Presença</title>
  <style>
    ${estiloBase}
    .section-title{font-size:15px;font-weight:bold;color:#1a3a6b;margin:18px 0 8px;padding:6px 10px;background:#e8eef8;border-radius:6px}
    .atividade-info{background:#fdf8f1;border:1px solid #e8c547;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px}
  </style></head><body>
    ${cabecalho('Lista de Presença', atividade.titulo)}
    
    <div class="atividade-info">
      📅 <strong>Data:</strong> ${atividade.data ? new Date(atividade.data+'T00:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }) : '—'} &nbsp;|&nbsp;
      📍 <strong>Local:</strong> ${atividade.local||'—'} &nbsp;|&nbsp;
      🎯 <strong>Tema:</strong> ${atividade.tema||'—'}
      ${atividade.hora_inicio ? ` &nbsp;|&nbsp; ⏰ <strong>Horário:</strong> ${atividade.hora_inicio}${atividade.hora_fim?' – '+atividade.hora_fim:''}` : ''}
    </div>

    ${criancas.length > 0 ? `
    <div class="section-title">👧 Crianças (${criancas.length})</div>
    <table>
      <thead><tr><th>#</th><th>Nome</th><th style="text-align:center">Assinatura / Presente</th></tr></thead>
      <tbody>${linhas(criancas)}</tbody>
    </table>` : ''}

    ${adultos.length > 0 ? `
    <div class="section-title">👤 Adultos (${adultos.length})</div>
    <table>
      <thead><tr><th>#</th><th>Nome</th><th style="text-align:center">Assinatura / Presente</th></tr></thead>
      <tbody>${linhas(adultos)}</tbody>
    </table>` : ''}

    ${rodape()}
  </body></html>`

  abrirJanela(html, 'Lista de Presença')
}

// ── 2. Estoque ───────────────────────────────────────────────

export function gerarRelatorioEstoquePDF(itens, ordem='alfabetica') {
  // A lista 'itens' já deve vir ordenada do componente
  const statusInfo = e => e.qtd_atual <= 0 
    ? { label:'🔴 Crítico', bg:'#fdf0ee', cor:'#c0392b' }
    : e.qtd_atual <= e.qtd_minima 
    ? { label:'⚠️ Baixo', bg:'#fef3e8', cor:'#d4680a' }
    : { label:'✅ OK', bg:'#eaf5ee', cor:'#2e7d52' }

  const criticos = itens.filter(e => e.qtd_atual <= 0).length
  const baixos = itens.filter(e => e.qtd_atual > 0 && e.qtd_atual <= e.qtd_minima).length
  const ok = itens.length - criticos - baixos

  const rows = itens.map((e,i) => {
    const s = statusInfo(e)
    return `<tr style="background:${i%2===0?'#f8faff':'white'}">
      <td>${e.produto}</td>
      <td>${e.categoria||'—'}</td>
      <td style="text-align:center;font-weight:700;color:${s.cor}">${e.qtd_atual}</td>
      <td style="text-align:center;color:#6b7280">${e.qtd_minima}</td>
      <td style="text-align:center;color:#6b7280">${e.unidade||'un'}</td>
      <td style="text-align:center;background:${s.bg}"><span style="color:${s.cor};font-weight:700;font-size:11px">${s.label}</span></td>
      ${e.observacao ? `<td style="font-size:11px;color:#6b7280">${e.observacao}</td>` : '<td style="color:#aaa">—</td>'}
    </tr>`
  }).join('')

  const ordemLabel = ordem === 'alfabetica' ? 'Ordem Alfabética (A→Z)' : 'Ordem por Criticidade (Crítico → Baixo → OK)'

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Estoque</title>
  <style>${estiloBase}</style></head><body>
    ${cabecalho('Relatório de Estoque', `Ordenação: ${ordemLabel}`)}
    
    <div class="resumo">
      <div class="res"><strong>${itens.length}</strong>Total de itens</div>
      <div class="res"><strong style="color:#2e7d52">${ok}</strong>Itens OK</div>
      <div class="res"><strong style="color:#d4680a">${baixos}</strong>Estoque Baixo</div>
      <div class="res"><strong style="color:#c0392b">${criticos}</strong>Estoque Crítico</div>
    </div>

    ${criticos > 0 ? `<div style="background:#fdf0ee;border:1px solid #c0392b;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#c0392b"><strong>⚠️ Atenção:</strong> ${criticos} item(s) com estoque zerado precisam de reposição urgente.</div>` : ''}

    <table>
      <thead><tr><th>Produto</th><th>Categoria</th><th>Qtd Atual</th><th>Qtd Mín</th><th>Unidade</th><th>Status</th><th>Observação</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${rodape()}
  </body></html>`

  abrirJanela(html, 'Relatório de Estoque')
}

// ── 3. Compras ───────────────────────────────────────────────

export function gerarRelatorioComprasPDF(compras, titulo='Relatório de Compras') {
  const total = compras.reduce((s,c) => s + (Number(c.valor_total)||0), 0)
  const porCat = {}
  compras.forEach(c => { porCat[c.categoria||'Outros'] = (porCat[c.categoria||'Outros']||0) + Number(c.valor_total||0) })

  const rows = compras.map((c,i) => `
    <tr style="background:${i%2===0?'#f8faff':'white'}">
      <td>${c.data ? new Date(c.data+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td><strong>${c.item}</strong></td>
      <td>${c.categoria||'—'}</td>
      <td>${c.atividade_nome||'—'}</td>
      <td style="text-align:center">${c.quantidade}</td>
      <td style="text-align:right">${fmt(c.valor_unitario)}</td>
      <td style="text-align:right;font-weight:700;color:#1a3a6b">${fmt(c.valor_total)}</td>
    </tr>`).join('')

  const catRows = Object.entries(porCat).sort((a,b) => b[1]-a[1]).map(([k,v]) => `
    <tr><td>${k}</td><td style="text-align:right;font-weight:700">${fmt(v)}</td>
    <td style="text-align:right;color:#888">${((v/total)*100).toFixed(1)}%</td></tr>`).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
  <style>${estiloBase}</style></head><body>
    ${cabecalho(titulo)}
    
    <div class="resumo">
      <div class="res"><strong>${compras.length}</strong>Total de itens</div>
      <div class="res"><strong style="color:#1a3a6b">${fmt(total)}</strong>Valor Total</div>
    </div>

    <h2>Detalhamento</h2>
    <table>
      <thead><tr><th>Data</th><th>Item</th><th>Categoria</th><th>Atividade</th><th>Qtd</th><th>Vl Unit</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#1a3a6b;color:white"><td colspan="6" style="font-weight:700;padding:10px">TOTAL GERAL</td><td style="text-align:right;font-weight:800;font-size:14px;padding:10px">${fmt(total)}</td></tr></tfoot>
    </table>

    <h2>Por Categoria</h2>
    <table>
      <thead><tr><th>Categoria</th><th style="text-align:right">Total</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${catRows}</tbody>
    </table>

    ${rodape()}
  </body></html>`

  abrirJanela(html, titulo)
}

// ── 4. Arrecadação ───────────────────────────────────────────

export function gerarRelatorioArrecadacaoPDF(acoes, mes='') {
  const totalMeta = acoes.reduce((s,a) => s + Number(a.meta_valor||0), 0)
  const totalArrecad = acoes.reduce((s,a) => s + Number(a.total_arrecadado||0), 0)
  const finalizadas = acoes.filter(a => a.status === 'finalizada').length
  const andamento = acoes.filter(a => a.status === 'em_andamento').length

  const rows = acoes.map((a,i) => {
    const stMap = { planejada:'#e8eef8', em_andamento:'#fef3e8', finalizada:'#eaf5ee', cancelada:'#f4f4f4' }
    const stLabel = { planejada:'📋 Planejada', em_andamento:'🔄 Em andamento', finalizada:'✅ Finalizada', cancelada:'⚫ Cancelada' }
    return `<tr style="background:${i%2===0?'#f8faff':'white'}">
      <td><strong>${a.nome}</strong>${a.detalhe ? `<br><span style="font-size:11px;color:#888">${a.detalhe}</span>` : ''}</td>
      <td style="text-align:center">${a.data_realizacao ? new Date(a.data_realizacao+'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
      <td style="background:${stMap[a.status]||'white'};text-align:center;font-size:11px;font-weight:700">${stLabel[a.status]||a.status}</td>
      <td style="text-align:right;color:#888">${a.meta_valor ? fmt(a.meta_valor) : '—'}</td>
      <td style="text-align:right;font-weight:700;color:${a.total_arrecadado>0?'#2e7d52':'#888'}">${a.total_arrecadado ? fmt(a.total_arrecadado) : '—'}</td>
      <td>${(a.responsaveis||[]).join(', ')||'—'}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Planejamento de Arrecadação</title>
  <style>${estiloBase}</style></head><body>
    ${cabecalho('Planejamento de Arrecadação', mes ? `Período: ${mes}` : '')}
    
    <div class="resumo">
      <div class="res"><strong>${acoes.length}</strong>Total de ações</div>
      <div class="res"><strong style="color:#2e7d52">${finalizadas}</strong>Finalizadas</div>
      <div class="res"><strong style="color:#d4680a">${andamento}</strong>Em andamento</div>
      <div class="res"><strong style="color:#1a3a6b">${fmt(totalMeta)}</strong>Meta total</div>
      <div class="res"><strong style="color:#2e7d52">${fmt(totalArrecad)}</strong>Arrecadado</div>
    </div>

    <table>
      <thead><tr><th>Ação / Detalhe</th><th>Data</th><th>Status</th><th style="text-align:right">Meta</th><th style="text-align:right">Arrecadado</th><th>Responsáveis</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="background:#f2f5fb;font-weight:700">
          <td colspan="3" style="padding:10px">TOTAIS</td>
          <td style="text-align:right;padding:10px">${fmt(totalMeta)}</td>
          <td style="text-align:right;padding:10px;color:#2e7d52">${fmt(totalArrecad)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    ${rodape()}
  </body></html>`

  abrirJanela(html, 'Arrecadação')
}

// ── 5. Financeiro ────────────────────────────────────────────

export function gerarRelatorioFinanceiroPDF(lancamentos, mes='') {
  const pagar = lancamentos.filter(l => l.tipo === 'pagar')
  const receber = lancamentos.filter(l => l.tipo === 'receber')
  const totPagar = pagar.reduce((s,l) => s + Number(l.valor||0), 0)
  const totRec = receber.reduce((s,l) => s + Number(l.valor||0), 0)
  const saldo = totRec - totPagar

  const stLabel = { pendente:'⏳ Pendente', pago:'✅ Pago', vencido:'🔴 Vencido', cancelado:'⚫ Cancelado' }
  const stBg = { pendente:'#fef3e8', pago:'#eaf5ee', vencido:'#fdf0ee', cancelado:'#f4f4f4' }

  const rowsLanc = (lista) => lista.map((l,i) => `
    <tr style="background:${i%2===0?'#f8faff':'white'}">
      <td><strong>${l.descricao}</strong>${l.favorecido?`<br><span style="font-size:11px;color:#888">→ ${l.favorecido}</span>`:''}</td>
      <td>${l.categoria||'—'}</td>
      <td style="text-align:center">${l.data_vencimento?new Date(l.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR'):'—'}</td>
      <td style="text-align:center;background:${stBg[l.status]||'white'};font-size:11px;font-weight:700">${stLabel[l.status]||l.status}</td>
      <td style="text-align:right;font-weight:700;color:${l.tipo==='receber'?'#2e7d52':'#c0392b'}">${fmt(l.valor)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Financeiro</title>
  <style>${estiloBase}</style></head><body>
    ${cabecalho('Relatório Financeiro', mes)}
    
    <div class="resumo">
      <div class="res"><strong style="color:#2e7d52">${fmt(totRec)}</strong>Total a Receber</div>
      <div class="res"><strong style="color:#c0392b">${fmt(totPagar)}</strong>Total a Pagar</div>
      <div class="res"><strong style="color:${saldo>=0?'#2e7d52':'#c0392b'}">${fmt(saldo)}</strong>Saldo do período</div>
    </div>

    ${receber.length > 0 ? `<h2>💚 Contas a Receber (${receber.length})</h2>
    <table><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${rowsLanc(receber)}</tbody>
    <tfoot><tr style="background:#eaf5ee"><td colspan="4" style="font-weight:700;padding:8px">SUBTOTAL A RECEBER</td><td style="text-align:right;font-weight:800;color:#2e7d52;padding:8px">${fmt(totRec)}</td></tr></tfoot>
    </table>` : ''}

    ${pagar.length > 0 ? `<h2>🔴 Contas a Pagar (${pagar.length})</h2>
    <table><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${rowsLanc(pagar)}</tbody>
    <tfoot><tr style="background:#fdf0ee"><td colspan="4" style="font-weight:700;padding:8px">SUBTOTAL A PAGAR</td><td style="text-align:right;font-weight:800;color:#c0392b;padding:8px">${fmt(totPagar)}</td></tr></tfoot>
    </table>` : ''}

    <div style="background:${saldo>=0?'#eaf5ee':'#fdf0ee'};border:2px solid ${saldo>=0?'#2e7d52':'#c0392b'};border-radius:10px;padding:16px 24px;text-align:center;margin-top:10px">
      <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px">Resultado do Período</div>
      <div style="font-size:28px;font-weight:900;color:${saldo>=0?'#2e7d52':'#c0392b'};margin-top:6px">${saldo>=0?'+':''}${fmt(saldo)}</div>
    </div>

    ${rodape()}
  </body></html>`

  abrirJanela(html, 'Relatório Financeiro')
}
