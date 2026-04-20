import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CSS_BASE = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Nunito',Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:12.5px}
  .header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}
  .header h1{font-family:'Cormorant Garamond',serif;font-size:21px;color:#1a3a6b;margin:5px 0 2px}
  .header .sub{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;font-weight:700}
  .periodo{background:#f2f5fb;padding:8px 14px;border-radius:8px;font-size:12px;color:#555;text-align:center;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px}
  th{background:#1a3a6b;color:white;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px}
  td{padding:7px 10px;border-bottom:1px solid #dce3f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8faff}
  .badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:800}
  .badge-plan{background:#e8eef8;color:#2a5298}
  .badge-real{background:#eaf5ee;color:#2e7d52}
  .badge-canc{background:#fdf0ee;color:#c0392b}
  .totais{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .total-box{background:#f2f5fb;padding:10px;border-radius:8px;text-align:center}
  .total-box strong{font-family:'Cormorant Garamond',serif;font-size:22px;color:#1a3a6b;display:block}
  .total-box span{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px;font-weight:700}
  .footer{margin-top:20px;text-align:center;font-size:10px;color:#888;border-top:1px solid #dce3f0;padding-top:12px}
  .sec-title{font-family:'Cormorant Garamond',serif;font-size:16px;color:#1a3a6b;font-weight:700;margin:18px 0 10px;padding-bottom:5px;border-bottom:1px solid #dce3f0}
  .part-box{background:white;border:1px solid #dce3f0;border-radius:8px;margin-bottom:10px;overflow:hidden}
  .part-header{background:#f2f5fb;padding:9px 13px;display:flex;justify-content:space-between;align-items:center}
  .part-nome{font-weight:800;color:#1a3a6b;font-size:13px}
  .part-info{font-size:11px;color:#888;margin-top:1px}
  .at-list{padding:9px 13px;display:flex;flex-direction:column;gap:5px}
  .at-item{display:flex;gap:10px;align-items:flex-start;font-size:12px;color:#1e2a3a}
  .at-data{color:#888;width:75px;flex-shrink:0;font-size:11px;margin-top:1px}
  @media print{button{display:none!important}body{padding:14px}}
`

function abrirJanela(html) {
  const win = window.open('', '_blank', 'width=1000,height=750')
  win.document.write(html); win.document.close()
}

function relAtividades(atividades, filtros) {
  const realizadas = atividades.filter(a => a.status==='realizada')
  const planejadas = atividades.filter(a => a.status==='planejada')
  const totalCriEst = realizadas.reduce((s,a)=>s+(a.qtd_criancas||0),0)
  const totalCriReal = realizadas.filter(a=>a.real_criancas!=null).reduce((s,a)=>s+(a.real_criancas||0),0)

  const linhas = atividades.map((a,i)=>{
    const est = (a.qtd_criancas||0)+(a.qtd_adultos||0)
    const real = a.real_criancas!=null?(a.real_criancas||0)+(a.real_adultos||0):null
    const pct = real!=null&&est>0?Math.round((real/est)*100):null
    const sb = a.status==='planejada'?'badge-plan':a.status==='realizada'?'badge-real':'badge-canc'
    const sl = a.status==='planejada'?'📅 Planejada':a.status==='realizada'?'✅ Realizada':'❌ Cancelada'
    return `<tr>
      <td style="text-align:center;color:#888;font-size:11px">${i+1}</td>
      <td style="white-space:nowrap">${a.data?new Date(a.data+'T12:00').toLocaleDateString('pt-BR'):'—'}</td>
      <td><strong>${a.titulo}</strong></td>
      <td style="color:#888">${a.tema||'—'}</td>
      <td>${a.local||'—'}</td>
      <td><span class="badge ${sb}">${sl}</span></td>
      <td style="text-align:center">${a.qtd_criancas||0}</td>
      <td style="text-align:center">${a.qtd_adultos||0}</td>
      <td style="text-align:center;font-weight:700">${real!=null?real:'—'}</td>
      <td style="text-align:center;color:${pct!=null?(pct>=90?'#2e7d52':pct>=70?'#c9a227':'#c0392b'):'#888'}">${pct!=null?pct+'%':'—'}</td>
    </tr>`
  }).join('')

  const periodo = filtros.inicio||filtros.fim
    ? `Período: ${filtros.inicio?new Date(filtros.inicio+'T12:00').toLocaleDateString('pt-BR'):'início'} até ${filtros.fim?new Date(filtros.fim+'T12:00').toLocaleDateString('pt-BR'):'hoje'}`
    : 'Período: Todo o histórico'

  abrirJanela(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de Atividades</title><style>${CSS_BASE}</style></head><body>
  <div class="header"><div class="sub">Instituto Nossa Senhora Menina</div><h1>Relatório de Atividades</h1><div style="font-size:11px;color:#888;margin-top:3px">Gerado em ${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div></div>
  <div class="periodo">${periodo} · <strong>${atividades.length}</strong> atividade(s)</div>
  <div class="totais">
    <div class="total-box"><strong>${realizadas.length}</strong><span>Realizadas</span></div>
    <div class="total-box"><strong>${planejadas.length}</strong><span>Planejadas</span></div>
    <div class="total-box"><strong>${totalCriEst.toLocaleString('pt-BR')}</strong><span>👧 Estimadas</span></div>
    <div class="total-box"><strong>${totalCriReal>0?totalCriReal.toLocaleString('pt-BR'):'—'}</strong><span>👧 Reais</span></div>
  </div>
  <table><thead><tr><th>#</th><th>Data</th><th>Atividade</th><th>Tema</th><th>Local</th><th>Status</th><th>👧Est</th><th>👨Est</th><th>Total Real</th><th>Aderência</th></tr></thead>
  <tbody>${linhas}</tbody></table>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:Nunito,sans-serif;font-weight:700">🖨️ Imprimir / Salvar PDF</button></div>
  </body></html>`)
}

function relParticipantes(participantes, presencas, atividades, tipo) {
  const lista = tipo==='todos'?participantes:participantes.filter(p=>p.tipo===tipo)
  const atMap = {}
  atividades.forEach(a=>{atMap[a.id]=a})

  const boxes = lista.map(p=>{
    const atsP = presencas.filter(pr=>pr.participante_id===p.id).map(pr=>atMap[pr.atividade_id]).filter(Boolean).sort((a,b)=>(a.data||'').localeCompare(b.data||''))
    const items = atsP.length>0
      ? atsP.map(a=>`<div class="at-item"><span class="at-data">${a.data?new Date(a.data+'T12:00').toLocaleDateString('pt-BR'):'—'}</span><span><strong>${a.titulo}</strong>${a.tema?` <span style="color:#888;font-size:11px">(${a.tema})</span>`:''}</span></div>`).join('')
      : '<div style="font-size:11px;color:#888;padding:2px 0">Nenhuma atividade vinculada</div>'
    return `<div class="part-box">
      <div class="part-header">
        <div><div class="part-nome">${p.tipo==='crianca'?'👧':'👨'} ${p.nome}</div>
        <div class="part-info">${p.tipo==='crianca'?`${p.idade?p.idade+' anos':'Idade não informada'}${p.bairro?' · '+p.bairro:''}${p.nome_responsavel?' · Resp: '+p.nome_responsavel+(p.parentesco?' ('+p.parentesco+')':''):''}`:p.bairro||''}</div></div>
        <div style="text-align:right"><div style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:700;color:#1a3a6b">${atsP.length}</div><div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase">atividade(s)</div></div>
      </div>
      <div class="at-list">${items}</div>
    </div>`
  }).join('')

  const tl = tipo==='crianca'?'Crianças':tipo==='adulto'?'Adultos':'Participantes'
  abrirJanela(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de ${tl} Atendidos</title><style>${CSS_BASE}</style></head><body>
  <div class="header"><div class="sub">Instituto Nossa Senhora Menina</div><h1>Relatório de ${tl} Atendidos</h1><div style="font-size:11px;color:#888;margin-top:3px">Gerado em ${new Date().toLocaleDateString('pt-BR')}</div></div>
  <div class="totais" style="grid-template-columns:repeat(3,1fr)">
    <div class="total-box"><strong>${lista.length}</strong><span>Total de ${tl}</span></div>
    <div class="total-box"><strong>${lista.filter(p=>presencas.some(pr=>pr.participante_id===p.id)).length}</strong><span>Com atividades</span></div>
    <div class="total-box"><strong>${lista.filter(p=>!presencas.some(pr=>pr.participante_id===p.id)).length}</strong><span>Sem atividades</span></div>
  </div>
  ${boxes}
  <div class="footer">✦ Instituto Nossa Senhora Menina · Portal Administrativo</div>
  <div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:Nunito,sans-serif;font-weight:700">🖨️ Imprimir / Salvar PDF</button></div>
  </body></html>`)
}

export default function Relatorios() {
  const [atividades, setAtividades]   = useState([])
  const [participantes, setParticipantes] = useState([])
  const [presencas, setPresencas]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [gerandoAt, setGerandoAt]     = useState(false)
  const [gerandoPart, setGerandoPart] = useState(false)

  const [atInicio,  setAtInicio]  = useState('')
  const [atFim,     setAtFim]     = useState('')
  const [atStatus,  setAtStatus]  = useState('todos')
  const [partTipo,  setPartTipo]  = useState('todos')

  useEffect(()=>{ load() },[])

  async function load() {
    setLoading(true)
    const [atR, pR, prR] = await Promise.all([
      supabase.from('atividades').select('*').order('data',{ascending:false}),
      supabase.from('participantes').select('*').order('nome'),
      supabase.from('presencas_atividade').select('*'),
    ])
    setAtividades(atR.data||[])
    setParticipantes(pR.data||[])
    setPresencas(prR.data||[])
    setLoading(false)
  }

  const atFiltradas = atividades.filter(a=>{
    const mS = atStatus==='todos'||a.status===atStatus
    const mI = !atInicio||(a.data&&a.data>=atInicio)
    const mF = !atFim||(a.data&&a.data<=atFim)
    return mS&&mI&&mF
  })

  const partFiltrados = partTipo==='todos'?participantes:participantes.filter(p=>p.tipo===partTipo)

  if (loading) return <div className="loading-center"><div className="spinner"/></div>

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">📄 Relatórios</h1><p className="page-subtitle">Gere relatórios em PDF de atividades e participantes</p></div>
      </div>

      {/* Relatório de Atividades */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><span className="card-title">🗓️ Relatório de Atividades</span></div>
        <div className="card-body">
          <div className="form-row form-row-2" style={{marginBottom:14}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Data Inicial</label>
              <input className="form-input" type="date" value={atInicio} onChange={e=>setAtInicio(e.target.value)}/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Data Final</label>
              <input className="form-input" type="date" value={atFim} onChange={e=>setAtFim(e.target.value)}/>
            </div>
          </div>
          <div className="form-group" style={{marginBottom:16}}>
            <label className="form-label">Status</label>
            <div className="tabs">
              {[['todos','Todas'],['realizada','✅ Realizadas'],['planejada','📅 Planejadas'],['cancelada','❌ Canceladas']].map(([v,l])=>(
                <button key={v} className={`tab ${atStatus===v?'active':''}`} onClick={()=>setAtStatus(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{background:'var(--azul-suave)',borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <div>
              <span style={{fontSize:13,fontWeight:700,color:'var(--azul)'}}>{atFiltradas.length} atividade(s) no período</span>
              <div style={{fontSize:12,color:'var(--cinza-medio)',marginTop:2}}>
                {atFiltradas.filter(a=>a.status==='realizada').length} realizadas ·{' '}
                {atFiltradas.reduce((s,a)=>s+(a.qtd_criancas||0),0)} crianças estimadas
              </div>
            </div>
            <button className="btn btn-primary" disabled={gerandoAt||atFiltradas.length===0}
              onClick={()=>{setGerandoAt(true);relAtividades(atFiltradas,{inicio:atInicio,fim:atFim});setTimeout(()=>setGerandoAt(false),800)}}>
              {gerandoAt?'⏳ Gerando...':'📄 Gerar Relatório PDF'}
            </button>
          </div>

          {atFiltradas.length===0&&(
            <div className="alert alert-gold" style={{marginTop:12,marginBottom:0}}>
              <span className="alert-icon">ℹ️</span><span>Nenhuma atividade nos filtros selecionados.</span>
            </div>
          )}
        </div>
      </div>

      {/* Relatório de Participantes */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-header"><span className="card-title">👧 Relatório de Participantes Atendidos</span></div>
        <div className="card-body">
          <div className="alert alert-blue" style={{marginBottom:14}}>
            <span className="alert-icon">ℹ️</span>
            <div style={{fontSize:13}}>Lista cada participante com as atividades em que participou, com base nos registros de presença confirmada.</div>
          </div>
          <div className="form-group" style={{marginBottom:16}}>
            <label className="form-label">Tipo de Participante</label>
            <div className="tabs">
              {[['todos','👥 Todos'],['crianca','👧 Crianças'],['adulto','👨 Adultos']].map(([v,l])=>(
                <button key={v} className={`tab ${partTipo===v?'active':''}`} onClick={()=>setPartTipo(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{background:'var(--azul-suave)',borderRadius:10,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:10}}>
            <div>
              <span style={{fontSize:13,fontWeight:700,color:'var(--azul)'}}>{partFiltrados.length} participante(s) selecionado(s)</span>
              <div style={{fontSize:12,color:'var(--cinza-medio)',marginTop:2}}>
                {partFiltrados.filter(p=>p.tipo==='crianca').length} crianças · {partFiltrados.filter(p=>p.tipo==='adulto').length} adultos
              </div>
            </div>
            <button className="btn btn-primary" disabled={gerandoPart||partFiltrados.length===0}
              onClick={()=>{setGerandoPart(true);relParticipantes(participantes,presencas,atividades,partTipo);setTimeout(()=>setGerandoPart(false),800)}}>
              {gerandoPart?'⏳ Gerando...':'📄 Gerar Relatório PDF'}
            </button>
          </div>
          {participantes.length===0&&(
            <div className="alert alert-gold" style={{marginTop:12,marginBottom:0}}>
              <span className="alert-icon">💡</span>
              <div>Nenhum participante cadastrado. Acesse <strong>👧 Participantes</strong> para cadastrar.</div>
            </div>
          )}
        </div>
      </div>

      {/* Preview da tabela */}
      {atFiltradas.length>0&&(
        <div className="card">
          <div className="card-header"><span className="card-title">📊 Preview — Atividades Selecionadas</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Atividade</th><th>Tema</th><th>Status</th><th style={{textAlign:'center'}}>👧 Est.</th><th style={{textAlign:'center'}}>👧 Real</th><th style={{textAlign:'center'}}>👨 Est.</th><th style={{textAlign:'center'}}>👨 Real</th></tr></thead>
              <tbody>
                {atFiltradas.slice(0,15).map(a=>(
                  <tr key={a.id}>
                    <td style={{whiteSpace:'nowrap',fontSize:12}}>{a.data?new Date(a.data+'T12:00').toLocaleDateString('pt-BR'):'—'}</td>
                    <td><strong style={{fontSize:13}}>{a.titulo}</strong></td>
                    <td style={{fontSize:12,color:'var(--cinza-medio)'}}>{a.tema||'—'}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status==='realizada'?'✅':a.status==='planejada'?'📅':'❌'} {a.status}</span></td>
                    <td style={{textAlign:'center',fontWeight:700}}>{a.qtd_criancas||0}</td>
                    <td style={{textAlign:'center',fontWeight:700,color:'var(--verde)'}}>{a.real_criancas!=null?a.real_criancas:<span style={{color:'var(--cinza)',fontWeight:400,fontSize:11}}>—</span>}</td>
                    <td style={{textAlign:'center',fontWeight:700}}>{a.qtd_adultos||0}</td>
                    <td style={{textAlign:'center',fontWeight:700,color:'var(--verde)'}}>{a.real_adultos!=null?a.real_adultos:<span style={{color:'var(--cinza)',fontWeight:400,fontSize:11}}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {atFiltradas.length>15&&<div style={{padding:'10px 16px',fontSize:12,color:'var(--cinza)',textAlign:'center',borderTop:'1px solid var(--borda)'}}>Mostrando 15 de {atFiltradas.length}. O PDF incluirá todas.</div>}
        </div>
      )}
    </div>
  )
}
