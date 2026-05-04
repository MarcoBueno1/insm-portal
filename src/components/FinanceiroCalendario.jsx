import React, { useState, useMemo } from 'react'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

const fmt = v => Number(v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })

// Cor por status financeiro
function corLanc(l) {
  if (l.status === 'pago')      return { bg:'#eaf5ee', borda:'#2e7d52', texto:'#2e7d52' }
  if (l.status === 'cancelado') return { bg:'#f4f6fb', borda:'#8a94a8', texto:'#8a94a8' }
  // Vencido?
  const venc = l.data_vencimento && new Date(l.data_vencimento+'T23:59:59') < new Date()
  if (venc)                     return { bg:'#fdf0ee', borda:'#c0392b', texto:'#c0392b' }
  if (l.tipo === 'pagar')       return { bg:'#fff0f0', borda:'#e74c3c', texto:'#c0392b' }
  return                               { bg:'#f0fff4', borda:'#27ae60', texto:'#2e7d52' }
}

// ── Gerador de PDF em formato calendário ─────────────────────────────────────
export function gerarPdfFinanceiroCalendario(lancamentos, tipo, ano, mes) {
  const diasNoMes   = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()
  const tipoLabel   = tipo === 'pagar' ? '🔴 Contas a Pagar' : '💚 Contas a Receber'
  const tipoCorHex  = tipo === 'pagar' ? '#c0392b' : '#2e7d52'

  // Filtra apenas lançamentos do mês e tipo
  const doMes = lancamentos.filter(l => {
    if (l.tipo !== tipo || !l.data_vencimento) return false
    const d = new Date(l.data_vencimento + 'T12:00')
    return d.getFullYear() === ano && d.getMonth() === mes
  })

  // Agrupa por dia
  const porDia = {}
  doMes.forEach(l => {
    const dia = new Date(l.data_vencimento + 'T12:00').getDate()
    if (!porDia[dia]) porDia[dia] = []
    porDia[dia].push(l)
  })

  // Totais
  const totalGeral  = doMes.reduce((s,l) => s + Number(l.valor||0), 0)
  const totalPago   = doMes.filter(l => l.status==='pago').reduce((s,l) => s + Number(l.valor||0), 0)
  const totalPendente = totalGeral - totalPago
  const qtdVencidos = doMes.filter(l => l.status !== 'pago' && l.status !== 'cancelado' && l.data_vencimento && new Date(l.data_vencimento+'T23:59:59') < new Date()).length

  // Gera células
  const cells = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const semanas = []
  for (let i = 0; i < cells.length; i += 7) semanas.push(cells.slice(i, i + 7))

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  function statusLabel(l) {
    if (l.status === 'pago') return '✅ Pago'
    if (l.status === 'cancelado') return '⚫ Cancelado'
    const v = l.data_vencimento && new Date(l.data_vencimento+'T23:59:59') < new Date()
    return v ? '🔴 Vencido' : '⏳ Pendente'
  }
  function corStatus(l) {
    if (l.status === 'pago') return { bg:'#eaf5ee', c:'#2e7d52' }
    if (l.status === 'cancelado') return { bg:'#f4f6fb', c:'#888' }
    const v = l.data_vencimento && new Date(l.data_vencimento+'T23:59:59') < new Date()
    return v ? { bg:'#fdf0ee', c:'#c0392b' } : { bg:'#fef3e8', c:'#d4680a' }
  }

  function renderCell(dia) {
    if (!dia) return '<td style="background:#f8f8f8;border:1px solid #e8e8e8;vertical-align:top;padding:5px;width:14.28%;min-height:70px"></td>'
    const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
    const items   = porDia[dia] || []
    const isHoje  = dataStr === hojeStr
    const temItem = items.length > 0
    const bgCell  = isHoje ? '#fdf6e3' : temItem ? (tipo==='pagar'?'#fff8f8':'#f8fff9') : 'white'
    const bdCell  = isHoje ? '2px solid #c9a227' : temItem ? `1.5px solid ${tipoCorHex}44` : '1px solid #e8e8e8'

    const total = items.reduce((s,l) => s + Number(l.valor||0), 0)

    const itensHtml = items.map(l => {
      const cs = corStatus(l)
      return `<div style="background:${cs.bg};border-left:3px solid ${cs.c};padding:3px 5px;border-radius:3px;margin-top:3px;font-size:9.5px;line-height:1.3;">
        <div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${cs.c};max-width:115px">${l.descricao}</div>
        <div style="color:${cs.c};opacity:.9;font-weight:700">${fmt(l.valor)}</div>
        ${l.favorecido ? `<div style="opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">→ ${l.favorecido}</div>` : ''}
      </div>`
    }).join('')

    const totalHtml = items.length > 1
      ? `<div style="margin-top:4px;text-align:right;font-size:9px;font-weight:800;color:${tipoCorHex};border-top:1px solid ${tipoCorHex}33;padding-top:2px">Σ ${fmt(total)}</div>`
      : ''

    return `<td style="background:${bgCell};border:${bdCell};vertical-align:top;padding:5px;width:14.28%;min-height:70px;border-radius:3px;">
      <div style="font-size:10px;font-weight:${isHoje?'900':'700'};color:${isHoje?'#c9a227':temItem?tipoCorHex:'#aaa'};margin-bottom:2px">${dia}${isHoje?' ★':''}</div>
      ${itensHtml}${totalHtml}
    </td>`
  }

  const tabelaRows = semanas.map(sem => `<tr>${sem.map(renderCell).join('')}</tr>`).join('')

  // Detalhamento
  const detalheRows = [...doMes].sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento)).map(l => {
    const cs = corStatus(l)
    const dataFmt = new Date(l.data_vencimento+'T12:00').toLocaleDateString('pt-BR', {weekday:'short',day:'2-digit',month:'2-digit'})
    return `<tr>
      <td style="font-size:11px;color:#555;white-space:nowrap">${dataFmt}</td>
      <td><strong>${l.descricao}</strong>${l.favorecido?`<div style="font-size:10px;color:#888">→ ${l.favorecido}</div>`:''}</td>
      <td style="font-size:11px;color:#555">${l.categoria||'—'}</td>
      <td style="text-align:right;font-weight:700;color:${tipoCorHex}">${fmt(l.valor)}</td>
      <td style="text-align:center"><span style="background:${cs.bg};color:${cs.c};padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700">${statusLabel(l)}</span></td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${tipoLabel} — ${MESES_PT[mes]} ${ano}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Nunito',Arial,sans-serif;padding:22px;color:#1e2a3a;font-size:12px}
  .header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #c9a227}
  .inst{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase}
  h1{font-family:'Cormorant Garamond',serif;font-size:21px;color:#1a3a6b;margin:4px 0}
  .resumo{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
  .res{background:#f2f5fb;padding:8px 14px;border-radius:8px;font-size:11px;min-width:90px;text-align:center}
  .res strong{font-size:16px;display:block;margin-bottom:1px}
  .cal-table{width:100%;border-collapse:separate;border-spacing:3px;margin-bottom:22px;table-layout:fixed}
  .cal-head th{background:#1a3a6b;color:white;text-align:center;padding:5px;font-size:10px;text-transform:uppercase;letter-spacing:.6px;border-radius:2px}
  h2{color:#1a3a6b;font-size:13px;margin:18px 0 7px;border-bottom:1px solid #dce3f0;padding-bottom:3px;font-family:'Cormorant Garamond',serif}
  table.det{width:100%;border-collapse:collapse;font-size:11px}
  table.det th{background:#1a3a6b;color:white;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.6px}
  table.det td{padding:6px 10px;border:1px solid #dce3f0}
  table.det tr:nth-child(even){background:#f8faff}
  table.det tfoot td{background:#1a3a6b;color:white;font-weight:700;padding:8px 10px}
  .leg{display:flex;gap:14px;margin-bottom:12px;flex-wrap:wrap}
  .leg-item{display:flex;align-items:center;gap:5px;font-size:10.5px;color:#555}
  .leg-dot{width:12px;height:12px;border-radius:2px}
  .footer{margin-top:18px;text-align:center;font-size:10px;color:#888;border-top:1px solid #dce3f0;padding-top:10px}
  @media print{button{display:none!important}}
</style>
</head>
<body>
<div class="header">
  <div class="inst">Instituto Nossa Senhora Menina</div>
  <h1>${tipoLabel}</h1>
  <div style="font-size:14px;color:#555;margin-top:3px">${MESES_PT[mes]} de ${ano}</div>
  <div style="font-size:10px;color:#888;margin-top:2px">Gerado em ${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
</div>

<div class="resumo">
  <div class="res"><strong>${doMes.length}</strong>Lançamentos</div>
  <div class="res"><strong style="color:${tipoCorHex}">${fmt(totalGeral)}</strong>Total ${tipo==='pagar'?'a pagar':'a receber'}</div>
  <div class="res"><strong style="color:#2e7d52">${fmt(totalPago)}</strong>${tipo==='pagar'?'Pago':'Recebido'}</div>
  <div class="res"><strong style="color:#d4680a">${fmt(totalPendente)}</strong>Pendente</div>
  ${qtdVencidos > 0 ? `<div class="res"><strong style="color:#c0392b">${qtdVencidos}</strong>Vencido(s)</div>` : ''}
</div>

<div class="leg">
  <div class="leg-item"><div class="leg-dot" style="background:#eaf5ee;border-left:3px solid #2e7d52"></div> Pago/Recebido</div>
  <div class="leg-item"><div class="leg-dot" style="background:#fef3e8;border-left:3px solid #d4680a"></div> Pendente</div>
  <div class="leg-item"><div class="leg-dot" style="background:#fdf0ee;border-left:3px solid #c0392b"></div> Vencido</div>
  <div class="leg-item"><div class="leg-dot" style="background:#fdf6e3;border:2px solid #c9a227"></div> Hoje</div>
</div>

<table class="cal-table">
  <thead class="cal-head"><tr>${DIAS_PT.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
  <tbody>${tabelaRows}</tbody>
</table>

${doMes.length > 0 ? `
<h2>📋 Detalhamento — ${MESES_PT[mes]} ${ano}</h2>
<table class="det">
  <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th><th style="text-align:center">Status</th></tr></thead>
  <tbody>${detalheRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="3">TOTAL (${doMes.length} lançamento${doMes.length!==1?'s':''})</td>
      <td style="text-align:right;font-size:13px">${fmt(totalGeral)}</td>
      <td style="text-align:center;font-size:11px">💚 ${fmt(totalPago)} pago</td>
    </tr>
  </tfoot>
</table>` : '<div style="text-align:center;padding:20px;color:#888">Nenhum lançamento neste mês.</div>'}

<div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
<div style="text-align:center;margin-top:12px">
  <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:Nunito,sans-serif;font-weight:700">🖨️ Imprimir / Salvar PDF</button>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1150,height=820')
  win.document.write(html)
  win.document.close()
}

// ── Componente de calendário ──────────────────────────────────────────────────
export default function FinanceiroCalendario({ lancamentos, tipo, onAbrirLancamento, isCoord, abrirNovo }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const tipoLabel  = tipo === 'pagar' ? 'A Pagar' : 'A Receber'
  const tipoCorVar = tipo === 'pagar' ? 'var(--vermelho)' : 'var(--verde)'
  const tipoCorHex = tipo === 'pagar' ? '#c0392b' : '#2e7d52'
  const tipoBgVar  = tipo === 'pagar' ? 'var(--vermelho-bg)' : 'var(--verde-bg)'

  const diasNoMes   = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()

  // Lançamentos do tipo filtrados pelo mês
  const doMes = useMemo(() => lancamentos.filter(l => {
    if (l.tipo !== tipo || !l.data_vencimento) return false
    const d = new Date(l.data_vencimento + 'T12:00')
    return d.getFullYear() === ano && d.getMonth() === mes
  }), [lancamentos, tipo, ano, mes])

  const porDia = useMemo(() => {
    const m = {}
    doMes.forEach(l => {
      const dia = new Date(l.data_vencimento + 'T12:00').getDate()
      if (!m[dia]) m[dia] = []
      m[dia].push(l)
    })
    return m
  }, [doMes])

  const totalMes    = doMes.reduce((s,l) => s + Number(l.valor||0), 0)
  const totalPago   = doMes.filter(l => l.status==='pago').reduce((s,l) => s + Number(l.valor||0), 0)
  const totalPendente = totalMes - totalPago
  const qtdVencidos = doMes.filter(l => l.status !== 'pago' && l.status !== 'cancelado' && l.data_vencimento && new Date(l.data_vencimento+'T23:59:59') < new Date()).length

  const cells = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const semanas = []
  for (let i = 0; i < cells.length; i += 7) semanas.push(cells.slice(i, i + 7))

  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  function navMes(delta) {
    let m = mes + delta, a = ano
    if (m < 0)  { m = 11; a-- }
    if (m > 11) { m = 0;  a++ }
    setMes(m); setAno(a)
  }

  function statusInfo(l) {
    if (l.status === 'pago')      return { label:'✅ Pago',      bg:'var(--verde-bg)',    cor:'var(--verde)' }
    if (l.status === 'cancelado') return { label:'⚫ Cancelado', bg:'var(--cinza-cl)',     cor:'var(--cinza)' }
    const venc = l.data_vencimento && new Date(l.data_vencimento+'T23:59:59') < new Date()
    if (venc)                     return { label:'🔴 Vencido',   bg:'var(--vermelho-bg)', cor:'var(--vermelho)' }
    return                               { label:'⏳ Pendente',  bg:'var(--laran-bg)',    cor:'var(--laranja)' }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navMes(-1)} style={{ padding:'5px 11px', fontSize:17 }}>‹</button>
          <div style={{ fontFamily:'var(--font-display)', fontSize:21, fontWeight:700, color:'var(--azul)', minWidth:210, textAlign:'center' }}>
            {MESES_PT[mes]} {ano}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navMes(1)} style={{ padding:'5px 11px', fontSize:17 }}>›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()) }} style={{ fontSize:12 }}>Hoje</button>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* Totais rápidos */}
          <div style={{ background:tipoBgVar, padding:'4px 12px', borderRadius:20, fontSize:12, color:tipoCorVar, fontWeight:700 }}>
            {fmt(totalMes)} total
          </div>
          {totalPago > 0 && (
            <div style={{ background:'var(--verde-bg)', padding:'4px 12px', borderRadius:20, fontSize:12, color:'var(--verde)', fontWeight:700 }}>
              ✅ {fmt(totalPago)} {tipo==='pagar' ? 'pago' : 'recebido'}
            </div>
          )}
          {totalPendente > 0 && (
            <div style={{ background:'var(--laran-bg)', padding:'4px 12px', borderRadius:20, fontSize:12, color:'var(--laranja)', fontWeight:700 }}>
              ⏳ {fmt(totalPendente)} pendente
            </div>
          )}
          {qtdVencidos > 0 && (
            <div style={{ background:'var(--vermelho-bg)', padding:'4px 12px', borderRadius:20, fontSize:12, color:'var(--vermelho)', fontWeight:700 }}>
              🔴 {qtdVencidos} vencido{qtdVencidos!==1?'s':''}
            </div>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => gerarPdfFinanceiroCalendario(lancamentos, tipo, ano, mes)}>
            📄 PDF Calendário
          </button>
          {isCoord && (
            <button
              className={`btn btn-sm ${tipo === 'pagar' ? 'btn-danger' : 'btn-success'}`}
              onClick={() => abrirNovo && abrirNovo(tipo)}
            >
              + {tipo === 'pagar' ? 'Nova despesa' : 'Nova entrada'}
            </button>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display:'flex', gap:14, marginBottom:12, flexWrap:'wrap' }}>
        {[
          { bg:'var(--verde-bg)',    borda:'var(--verde)',    label:'Pago / Recebido' },
          { bg:'var(--laran-bg)',    borda:'var(--laranja)',  label:'Pendente' },
          { bg:'var(--vermelho-bg)', borda:'var(--vermelho)', label:'Vencido' },
          { bg:'#fdf6e3',           borda:'var(--dourado)',  label:'Hoje' },
        ].map(l => (
          <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, color:'var(--cinza-medio)' }}>
            <div style={{ width:13, height:13, borderRadius:3, background:l.bg, borderLeft:`3px solid ${l.borda}` }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Grade calendário */}
      <div style={{ overflowX:'auto' }}>
        {/* Cabeçalho dias semana */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3, marginBottom:3, minWidth:560 }}>
          {DIAS_PT.map(d => (
            <div key={d} style={{ textAlign:'center', padding:'7px 4px', background:'var(--azul)', color:'white', borderRadius:'var(--radius-sm)', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:.7 }}>{d}</div>
          ))}
        </div>

        {/* Semanas */}
        {semanas.map((semana, si) => (
          <div key={si} style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3, marginBottom:3, minWidth:560 }}>
            {semana.map((dia, di) => {
              if (dia === null) return (
                <div key={di} style={{ background:'var(--cinza-cl)', borderRadius:'var(--radius-sm)', minHeight:72, opacity:.35 }} />
              )
              const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
              const items   = porDia[dia] || []
              const isHoje  = dataStr === hojeStr
              const temItem = items.length > 0
              const totalDia = items.reduce((s,l) => s + Number(l.valor||0), 0)

              const bgCell   = isHoje ? '#fdf6e3' : temItem ? (tipo==='pagar'?'#fff5f5':'#f5fff8') : 'white'
              const bdCell   = isHoje ? '2px solid var(--dourado)' : temItem ? `1.5px solid ${tipoCorHex}66` : '1px solid var(--borda)'

              return (
                <div key={di} style={{ background:bgCell, border:bdCell, borderRadius:'var(--radius-sm)', minHeight:72, padding:6, display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:11.5, fontWeight:isHoje?900:700, color:isHoje?'var(--dourado)':temItem?tipoCorVar:'var(--cinza)' }}>
                      {dia}{isHoje && <span style={{ fontSize:9, background:'var(--dourado)', color:'white', padding:'1px 4px', borderRadius:7, marginLeft:3 }}>HOJE</span>}
                    </span>
                    {items.length > 1 && (
                      <span style={{ fontSize:9.5, fontWeight:800, color:tipoCorVar }}>{fmt(totalDia)}</span>
                    )}
                  </div>

                  {items.map(l => {
                    const si = statusInfo(l)
                    const c  = corLanc(l)
                    return (
                      <div
                        key={l.id}
                        onClick={() => onAbrirLancamento && onAbrirLancamento(l)}
                        title={`${l.descricao} — ${fmt(l.valor)}${l.favorecido?' ('+l.favorecido+')':''}\n${si.label}`}
                        style={{ background:c.bg, borderLeft:`3px solid ${c.borda}`, padding:'3px 5px', borderRadius:4, cursor:'pointer', fontSize:10.5, lineHeight:1.35, transition:'opacity .15s, transform .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity='.82'; e.currentTarget.style.transform='scale(1.02)' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity='1';  e.currentTarget.style.transform='scale(1)' }}
                      >
                        <div style={{ fontWeight:800, color:c.texto, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.descricao}</div>
                        <div style={{ color:c.texto, fontWeight:700, fontSize:10 }}>{fmt(l.valor)}</div>
                        {l.favorecido && <div style={{ color:c.texto, opacity:.7, fontSize:9.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>→ {l.favorecido}</div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Lista detalhada do mês */}
      {doMes.length > 0 && (
        <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--borda)' }}>
          <div style={{ fontSize:11, fontWeight:800, color:'var(--azul)', textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>
            📋 Lançamentos de {MESES_PT[mes]} — {tipoLabel}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {[...doMes].sort((a,b) => a.data_vencimento.localeCompare(b.data_vencimento)).map(l => {
              const si = statusInfo(l)
              const c  = corLanc(l)
              const dataFmt = new Date(l.data_vencimento+'T12:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
              return (
                <div
                  key={l.id}
                  onClick={() => onAbrirLancamento && onAbrirLancamento(l)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:c.bg, borderLeft:`4px solid ${c.borda}`, borderRadius:'var(--radius-sm)', cursor:'pointer', transition:'opacity .15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity='.82'}
                  onMouseLeave={e => e.currentTarget.style.opacity='1'}
                >
                  <div style={{ fontSize:12, fontWeight:700, color:c.texto, minWidth:68 }}>{dataFmt}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:c.texto }}>{l.descricao}</div>
                    <div style={{ fontSize:11, color:c.texto, opacity:.75, display:'flex', gap:8, flexWrap:'wrap' }}>
                      {l.categoria && <span>🏷️ {l.categoria}</span>}
                      {l.favorecido && <span>→ {l.favorecido}</span>}
                      {l.observacao && <span style={{ fontStyle:'italic' }}>{l.observacao}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:tipoCorVar }}>{fmt(l.valor)}</div>
                    <span style={{ background:si.bg, color:si.cor, padding:'1px 8px', borderRadius:10, fontSize:10, fontWeight:700 }}>{si.label}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totalizador */}
          <div style={{ marginTop:12, padding:'10px 14px', background:'var(--azul-suave)', borderRadius:'var(--radius-sm)', display:'flex', gap:20, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <span style={{ fontSize:12, color:'var(--cinza-medio)' }}>Total: <strong style={{ color:tipoCorVar }}>{fmt(totalMes)}</strong></span>
            <span style={{ fontSize:12, color:'var(--cinza-medio)' }}>{tipo==='pagar'?'Pago':'Recebido'}: <strong style={{ color:'var(--verde)' }}>{fmt(totalPago)}</strong></span>
            <span style={{ fontSize:12, color:'var(--cinza-medio)' }}>Pendente: <strong style={{ color:'var(--laranja)' }}>{fmt(totalPendente)}</strong></span>
          </div>
        </div>
      )}

      {doMes.length === 0 && (
        <div style={{ textAlign:'center', padding:'32px 0', color:'var(--cinza)' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>{tipo==='pagar'?'🔴':'💚'}</div>
          <div style={{ fontWeight:700 }}>Nenhum lançamento em {MESES_PT[mes]}</div>
        </div>
      )}
    </div>
  )
}
