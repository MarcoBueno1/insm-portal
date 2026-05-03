import React, { useState, useMemo } from 'react'

const STATUS_COR = {
  planejada: { bg: '#e8eef8', borda: '#1a3a6b', texto: '#1a3a6b', badge: '#1a3a6b', badgeTexto: '#fff' },
  realizada:  { bg: '#eaf5ee', borda: '#2e7d52', texto: '#2e7d52', badge: '#2e7d52', badgeTexto: '#fff' },
  cancelada:  { bg: '#fdf0ee', borda: '#c0392b', texto: '#c0392b', badge: '#c0392b', badgeTexto: '#fff' },
}

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_PT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function gerarPdfCalendario(atividades, ano, mes) {
  const diasNoMes  = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()

  // Agrupa atividades por dia
  const porDia = {}
  atividades.forEach(a => {
    if (!a.data) return
    const d = new Date(a.data + 'T12:00')
    if (d.getFullYear() === ano && d.getMonth() === mes) {
      const dia = d.getDate()
      if (!porDia[dia]) porDia[dia] = []
      porDia[dia].push(a)
    }
  })

  // Gera semanas
  const cells = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const semanas = []
  for (let i = 0; i < cells.length; i += 7) semanas.push(cells.slice(i, i + 7))

  const hoje = new Date()
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  const renderCell = (dia) => {
    if (!dia) return '<td style="background:#f8f8f8;border:1px solid #e0e0e0;min-height:80px;width:14.28%;vertical-align:top;padding:6px;"></td>'
    const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
    const ats = porDia[dia] || []
    const isHoje = dataStr === hojeStr
    const temAtiv = ats.length > 0
    const bgCell  = isHoje ? '#fdf6e3' : temAtiv ? '#f0f4ff' : 'white'
    const bordaCell = isHoje ? '2px solid #c9a227' : temAtiv ? '1.5px solid #4a7fcb' : '1px solid #e0e0e0'

    const atividadesHtml = ats.map(a => {
      const cor = STATUS_COR[a.status] || STATUS_COR.planejada
      return `<div style="background:${cor.bg};border-left:3px solid ${cor.borda};padding:3px 6px;border-radius:3px;margin-top:4px;font-size:10px;color:${cor.texto};line-height:1.3;">
        <div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">${a.titulo}</div>
        ${a.hora_inicio ? `<div style="opacity:.8">${a.hora_inicio}${a.hora_fim?'–'+a.hora_fim:''}</div>` : ''}
        ${a.local ? `<div style="opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📍 ${a.local}</div>` : ''}
      </div>`
    }).join('')

    return `<td style="background:${bgCell};border:${bordaCell};min-height:80px;width:14.28%;vertical-align:top;padding:6px;border-radius:4px;">
      <div style="font-size:11px;font-weight:${isHoje?'900':'700'};color:${isHoje?'#c9a227':temAtiv?'#1a3a6b':'#555'};margin-bottom:2px;">${dia}${isHoje?' ★':''}</div>
      ${atividadesHtml}
    </td>`
  }

  const tabelaRows = semanas.map(sem =>
    `<tr>${sem.map(renderCell).join('')}</tr>`
  ).join('')

  const totalAtiv  = atividades.filter(a => {
    if (!a.data) return false
    const d = new Date(a.data + 'T12:00')
    return d.getFullYear() === ano && d.getMonth() === mes
  })
  const qtdPlan = totalAtiv.filter(a => a.status === 'planejada').length
  const qtdReal = totalAtiv.filter(a => a.status === 'realizada').length
  const qtdCanc = totalAtiv.filter(a => a.status === 'cancelada').length

  // Lista detalhada
  const detalheRows = totalAtiv
    .sort((a,b) => a.data.localeCompare(b.data))
    .map(a => {
      const cor = STATUS_COR[a.status] || STATUS_COR.planejada
      const dataFmt = new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
      return `<tr>
        <td style="font-size:11px;color:#555;white-space:nowrap">${dataFmt}</td>
        <td><strong>${a.titulo}</strong>${a.tema?` <span style="font-size:10px;color:#888">· ${a.tema}</span>`:''}</td>
        <td style="font-size:11px;color:#555">${a.hora_inicio||'—'}${a.hora_fim?'–'+a.hora_fim:''}</td>
        <td style="font-size:11px;color:#555">${a.local||'—'}</td>
        <td style="text-align:center;font-size:11px">👧${a.qtd_criancas||0} 👨${a.qtd_adultos||0}</td>
        <td><span style="background:${cor.badge};color:${cor.badgeTexto};padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">${a.status}</span></td>
      </tr>`
    }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Calendário de Atividades — ${MESES_PT[mes]} ${ano}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Nunito',Arial,sans-serif;padding:24px;color:#1e2a3a;font-size:12px}
  .header{text-align:center;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #c9a227}
  .inst{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase}
  h1{font-family:'Cormorant Garamond',serif;font-size:22px;color:#1a3a6b;margin:4px 0}
  .resumo{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
  .res{background:#f2f5fb;padding:8px 14px;border-radius:8px;font-size:12px;min-width:100px;text-align:center}
  .res strong{color:#1a3a6b;font-size:18px;display:block}
  .cal-table{width:100%;border-collapse:separate;border-spacing:3px;margin-bottom:24px;table-layout:fixed}
  .cal-header th{background:#1a3a6b;color:white;text-align:center;padding:6px;font-size:11px;text-transform:uppercase;letter-spacing:.7px;border-radius:3px}
  .cal-table td{min-height:80px;border-radius:4px}
  h2{color:#1a3a6b;font-size:14px;margin:20px 0 8px;border-bottom:1px solid #dce3f0;padding-bottom:4px;font-family:'Cormorant Garamond',serif}
  table.detalhe{width:100%;border-collapse:collapse;font-size:11.5px}
  table.detalhe th{background:#1a3a6b;color:white;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.7px}
  table.detalhe td{padding:7px 10px;border:1px solid #dce3f0}
  table.detalhe tr:nth-child(even){background:#f8faff}
  .legend{display:flex;gap:14px;margin-bottom:14px;flex-wrap:wrap}
  .leg{display:flex;align-items:center;gap:6px;font-size:11px}
  .leg-dot{width:14px;height:14px;border-radius:3px}
  .footer{margin-top:20px;text-align:center;font-size:10px;color:#888;border-top:1px solid #dce3f0;padding-top:10px}
  @media print{button{display:none!important}.no-break{page-break-inside:avoid}}
</style>
</head>
<body>
<div class="header">
  <div class="inst">Instituto Nossa Senhora Menina</div>
  <h1>🗓️ Calendário de Atividades</h1>
  <div style="font-size:14px;color:#555;margin-top:4px">${MESES_PT[mes]} de ${ano}</div>
  <div style="font-size:11px;color:#888;margin-top:2px">Gerado em ${new Date().toLocaleDateString('pt-BR', {weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
</div>

<div class="resumo">
  <div class="res"><strong>${totalAtiv.length}</strong>Total</div>
  <div class="res"><strong style="color:#1a3a6b">${qtdPlan}</strong>Planejadas</div>
  <div class="res"><strong style="color:#2e7d52">${qtdReal}</strong>Realizadas</div>
  <div class="res"><strong style="color:#c0392b">${qtdCanc}</strong>Canceladas</div>
</div>

<div class="legend">
  <div class="leg"><div class="leg-dot" style="background:#e8eef8;border-left:3px solid #1a3a6b"></div> Planejada</div>
  <div class="leg"><div class="leg-dot" style="background:#eaf5ee;border-left:3px solid #2e7d52"></div> Realizada</div>
  <div class="leg"><div class="leg-dot" style="background:#fdf0ee;border-left:3px solid #c0392b"></div> Cancelada</div>
  <div class="leg"><div class="leg-dot" style="background:#fdf6e3;border:2px solid #c9a227"></div> Hoje</div>
</div>

<table class="cal-table">
  <thead class="cal-header"><tr>${DIAS_PT.map(d=>`<th>${d}</th>`).join('')}</tr></thead>
  <tbody>${tabelaRows}</tbody>
</table>

${totalAtiv.length > 0 ? `
<h2>📋 Detalhamento das Atividades do Mês</h2>
<table class="detalhe no-break">
  <thead><tr><th>Data</th><th>Atividade</th><th>Horário</th><th>Local</th><th>Participantes</th><th>Status</th></tr></thead>
  <tbody>${detalheRows}</tbody>
</table>` : '<div style="text-align:center;padding:20px;color:#888">Nenhuma atividade neste mês.</div>'}

<div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
<div style="text-align:center;margin-top:12px">
  <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:Nunito,sans-serif;font-weight:700">🖨️ Imprimir / Salvar PDF</button>
</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1200,height=820')
  win.document.write(html)
  win.document.close()
}

export default function AtividadesCalendario({ atividades, onAbrirAtividade }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth())

  const diasNoMes   = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()

  // Atividades do mês atual agrupadas por dia
  const porDia = useMemo(() => {
    const mapa = {}
    atividades.forEach(a => {
      if (!a.data) return
      const d = new Date(a.data + 'T12:00')
      if (d.getFullYear() === ano && d.getMonth() === mes) {
        const dia = d.getDate()
        if (!mapa[dia]) mapa[dia] = []
        mapa[dia].push(a)
      }
    })
    return mapa
  }, [atividades, ano, mes])

  const totalMes  = Object.values(porDia).flat()
  const qtdPlan   = totalMes.filter(a => a.status === 'planejada').length
  const qtdReal   = totalMes.filter(a => a.status === 'realizada').length
  const qtdCanc   = totalMes.filter(a => a.status === 'cancelada').length

  // Gera células do calendário
  const cells = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= diasNoMes; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const semanas = []
  for (let i = 0; i < cells.length; i += 7) semanas.push(cells.slice(i, i + 7))

  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

  function navMes(delta) {
    let m = mes + delta
    let a = ano
    if (m < 0)  { m = 11; a-- }
    if (m > 11) { m = 0;  a++ }
    setMes(m); setAno(a)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Cabeçalho do calendário */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navMes(-1)}
            style={{ padding: '6px 12px', fontSize: 16 }}
          >‹</button>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--azul)', minWidth: 220, textAlign: 'center' }}>
            {MESES_PT[mes]} {ano}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navMes(1)}
            style={{ padding: '6px 12px', fontSize: 16 }}
          >›</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setMes(hoje.getMonth()); setAno(hoje.getFullYear()) }}
            style={{ fontSize: 12 }}
          >Hoje</button>
        </div>

        {/* Stats rápidos do mês */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ background: 'var(--azul-suave)', padding: '4px 12px', borderRadius: 20, fontSize: 12, color: 'var(--azul)', fontWeight: 700 }}>
            📅 {qtdPlan} planejada{qtdPlan !== 1 ? 's' : ''}
          </div>
          <div style={{ background: 'var(--verde-bg)', padding: '4px 12px', borderRadius: 20, fontSize: 12, color: 'var(--verde)', fontWeight: 700 }}>
            ✅ {qtdReal} realizada{qtdReal !== 1 ? 's' : ''}
          </div>
          {qtdCanc > 0 && (
            <div style={{ background: 'var(--vermelho-bg)', padding: '4px 12px', borderRadius: 20, fontSize: 12, color: 'var(--vermelho)', fontWeight: 700 }}>
              ❌ {qtdCanc} cancelada{qtdCanc !== 1 ? 's' : ''}
            </div>
          )}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => gerarPdfCalendario(atividades, ano, mes)}
          >
            📄 PDF Calendário
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { bg: 'var(--azul-suave)', borda: 'var(--azul)', label: 'Planejada' },
          { bg: 'var(--verde-bg)',   borda: 'var(--verde)', label: 'Realizada' },
          { bg: 'var(--vermelho-bg)',borda: 'var(--vermelho)', label: 'Cancelada' },
          { bg: '#fdf6e3', borda: 'var(--dourado)', label: 'Hoje' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--cinza-medio)' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: l.bg, borderLeft: `3px solid ${l.borda}` }} />
            {l.label}
          </div>
        ))}
      </div>

      {/* Grade do calendário */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Cabeçalho dos dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
          {DIAS_PT.map(d => (
            <div key={d} style={{
              textAlign: 'center', padding: '8px 4px',
              background: 'var(--azul)', color: 'white',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.8px'
            }}>{d}</div>
          ))}
        </div>

        {/* Semanas */}
        {semanas.map((semana, si) => (
          <div key={si} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
            {semana.map((dia, di) => {
              if (dia === null) {
                return <div key={di} style={{ background: 'var(--cinza-cl)', borderRadius: 'var(--radius-sm)', minHeight: 80, opacity: .4 }} />
              }
              const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
              const ats     = porDia[dia] || []
              const isHoje  = dataStr === hojeStr
              const temAtiv = ats.length > 0

              const bgCell    = isHoje ? '#fdf6e3' : temAtiv ? 'var(--azul-suave)' : 'white'
              const bordaCell = isHoje ? '2px solid var(--dourado)' : temAtiv ? '1.5px solid var(--azul-claro)' : '1px solid var(--borda)'

              return (
                <div key={di} style={{
                  background: bgCell,
                  border: bordaCell,
                  borderRadius: 'var(--radius-sm)',
                  minHeight: 80,
                  padding: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  position: 'relative',
                  transition: 'box-shadow .15s',
                }}>
                  {/* Número do dia */}
                  <div style={{
                    fontSize: 12,
                    fontWeight: isHoje ? 900 : 700,
                    color: isHoje ? 'var(--dourado)' : temAtiv ? 'var(--azul)' : 'var(--cinza)',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    {dia}
                    {isHoje && <span style={{ fontSize: 9, background: 'var(--dourado)', color: 'white', padding: '1px 5px', borderRadius: 8 }}>HOJE</span>}
                  </div>

                  {/* Atividades do dia */}
                  {ats.map(a => {
                    const cor = STATUS_COR[a.status] || STATUS_COR.planejada
                    return (
                      <div
                        key={a.id}
                        onClick={() => onAbrirAtividade && onAbrirAtividade(a)}
                        style={{
                          background: cor.bg,
                          borderLeft: `3px solid ${cor.borda}`,
                          padding: '3px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          transition: 'opacity .15s, transform .15s',
                          fontSize: 11,
                          lineHeight: 1.35,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '.82'; e.currentTarget.style.transform = 'scale(1.02)' }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1';   e.currentTarget.style.transform = 'scale(1)' }}
                        title={`${a.titulo}${a.local ? ` — ${a.local}` : ''}${a.hora_inicio ? ` (${a.hora_inicio})` : ''}`}
                      >
                        <div style={{ fontWeight: 800, color: cor.texto, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.titulo}
                        </div>
                        {a.hora_inicio && (
                          <div style={{ color: cor.texto, opacity: .75, fontSize: 10 }}>
                            ⏰ {a.hora_inicio}{a.hora_fim ? `–${a.hora_fim}` : ''}
                          </div>
                        )}
                        {a.local && (
                          <div style={{ color: cor.texto, opacity: .65, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            📍 {a.local}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Rodapé: atividades do mês listadas */}
      {totalMes.length > 0 && (
        <div style={{ marginTop: 18, padding: '12px 0', borderTop: '1px solid var(--borda)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
            📋 Atividades em {MESES_PT[mes]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...totalMes]
              .sort((a,b) => a.data.localeCompare(b.data))
              .map(a => {
                const cor = STATUS_COR[a.status] || STATUS_COR.planejada
                const dataFmt = new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
                return (
                  <div
                    key={a.id}
                    onClick={() => onAbrirAtividade && onAbrirAtividade(a)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 12px', background: cor.bg,
                      borderLeft: `4px solid ${cor.borda}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', transition: 'opacity .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: cor.texto, minWidth: 70 }}>{dataFmt}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: cor.texto }}>{a.titulo}</div>
                      <div style={{ fontSize: 11, color: cor.texto, opacity: .75, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {a.hora_inicio && <span>⏰ {a.hora_inicio}{a.hora_fim?`–${a.hora_fim}`:''}</span>}
                        {a.local && <span>📍 {a.local}</span>}
                        {a.tema && <span>🎯 {a.tema}</span>}
                        <span>👧 {a.qtd_criancas||0} 👨 {a.qtd_adultos||0}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, background: cor.badge, color: cor.badgeTexto, padding: '2px 8px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {a.status === 'planejada' ? '📅' : a.status === 'realizada' ? '✅' : '❌'} {a.status}
                    </span>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}
    </div>
  )
}
