// src/components/RoteiroModal.jsx
import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

const SUBTIPOS = {
  cafe:   { label: 'Café / Lanche',   emoji: '☕', cor: 'var(--dourado)',  bg: 'var(--dourado-bg)' },
  almoco: { label: 'Almoço',          emoji: '🍽️', cor: 'var(--verde)',   bg: 'var(--verde-bg)'   },
  lanche: { label: 'Lanche da tarde', emoji: '🥪', cor: 'var(--laranja)', bg: 'var(--laranja-bg)' },
  outro:  { label: 'Intervalo',       emoji: '⏸️', cor: 'var(--cinza)',   bg: 'var(--cinza-cl)'   },
}

const EMPTY_ITEM = {
  tipo: 'item',
  subtipo_intervalo: 'cafe',
  titulo: '',
  descricao: '',
  responsavel: '',
  horario_inicio: '',
  horario_fim: '',
}

function gerarRoteiroHTML(atividade, itens) {
  const dataFmt = atividade.data
    ? new Date(atividade.data + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : ''

  const linhas = itens.map((item, i) => {
    const horario = item.horario_inicio
      ? `${item.horario_inicio.slice(0, 5)}${item.horario_fim ? ' – ' + item.horario_fim.slice(0, 5) : ''}`
      : '—'

    if (item.tipo === 'intervalo') {
      const sub = SUBTIPOS[item.subtipo_intervalo] || SUBTIPOS.outro
      return `
        <tr class="linha-intervalo">
          <td style="text-align:center;color:#888;width:32px;font-size:11px">${i + 1}</td>
          <td style="font-size:12px;color:#2a5298;font-weight:700;white-space:nowrap;width:110px">${horario}</td>
          <td colspan="2">
            <span style="display:inline-flex;align-items:center;gap:5px;background:#fdf6e3;color:#c9a227;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">
              ${sub.emoji} ${item.titulo}
            </span>
            ${item.descricao ? `<div style="font-size:11px;color:#888;margin-top:2px">${item.descricao}</div>` : ''}
          </td>
        </tr>`
    }

    return `
      <tr>
        <td style="text-align:center;color:#888;width:32px;font-size:11px">${i + 1}</td>
        <td style="font-size:12px;color:#2a5298;font-weight:700;white-space:nowrap;width:110px">${horario}</td>
        <td>
          <strong style="font-size:13px">${item.titulo}</strong>
          ${item.descricao ? `<div style="font-size:11px;color:#888;margin-top:2px">${item.descricao}</div>` : ''}
        </td>
        <td style="font-size:12px;color:#6b7280;width:150px">${item.responsavel || '—'}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Roteiro — ${atividade.titulo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Nunito:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Nunito',Arial,sans-serif;padding:28px;color:#1e2a3a;font-size:13px}
    .header{text-align:center;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #c9a227}
    .header h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#1a3a6b;margin:6px 0 2px}
    .header .sub{font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase}
    .info{background:#f2f5fb;border-radius:10px;padding:12px 16px;margin-bottom:18px}
    .info h2{font-family:'Cormorant Garamond',serif;font-size:17px;color:#1a3a6b;margin-bottom:6px}
    .info-row{display:flex;gap:20px;font-size:12px;color:#555;flex-wrap:wrap}
    table{width:100%;border-collapse:collapse}
    th{background:#1a3a6b;color:white;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.8px}
    td{padding:8px 12px;border:1px solid #dce3f0;vertical-align:top}
    tr:nth-child(even) td{background:#f8faff}
    .linha-intervalo td{background:#fffbf0!important;border-top:1px dashed #c9a227;border-bottom:1px dashed #c9a227}
    .footer{margin-top:24px;text-align:center;font-size:10px;color:#888;border-top:1px solid #dce3f0;padding-top:12px}
    @media print{button{display:none!important}}
  </style>
</head>
<body>
  <div class="header">
    <div class="sub">Instituto Nossa Senhora Menina</div>
    <h1>📋 Roteiro da Atividade</h1>
    <div class="sub" style="margin-top:2px">Portal Administrativo</div>
  </div>
  <div class="info">
    <h2>${atividade.titulo}</h2>
    <div class="info-row">
      ${dataFmt ? `<span>📅 ${dataFmt}</span>` : ''}
      ${atividade.hora_inicio ? `<span>⏰ ${atividade.hora_inicio}${atividade.hora_fim ? '–' + atividade.hora_fim : ''}</span>` : ''}
      ${atividade.local ? `<span>📍 ${atividade.local}</span>` : ''}
      ${atividade.tema ? `<span>🎯 ${atividade.tema}</span>` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th style="width:110px">Horário</th>
        <th>Atividade / Item</th>
        <th style="width:150px">Responsável</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || '<tr><td colspan="4" style="text-align:center;color:#888;padding:20px">Nenhum item no roteiro.</td></tr>'}
    </tbody>
  </table>
  <div class="footer">✦ Instituto Nossa Senhora Menina · Gerado em ${new Date().toLocaleDateString('pt-BR')}</div>
  <div style="text-align:center;margin-top:16px">
    <button onclick="window.print()" style="padding:10px 28px;background:#1a3a6b;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-family:'Nunito',sans-serif;font-weight:700">
      🖨️ Imprimir Roteiro
    </button>
  </div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=960,height=700')
  win.document.write(html)
  win.document.close()
}

export default function RoteiroModal({ atividade, onClose }) {
  const toast = useToast()
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_ITEM })
  const [mostrarForm, setMostrarForm] = useState(false)

  useEffect(() => { carregarItens() }, [atividade.id])

  async function carregarItens() {
    setLoading(true)
    const { data, error } = await supabase
      .from('roteiro_itens')
      .select('*')
      .eq('atividade_id', atividade.id)
      .order('ordem', { ascending: true })
    if (error) toast('Erro ao carregar roteiro.', 'error')
    else setItens(data || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.titulo.trim()) { toast('Informe o título do item.', 'error'); return }
    setSaving(true)

    const payload = {
      atividade_id: atividade.id,
      tipo: form.tipo,
      subtipo_intervalo: form.tipo === 'intervalo' ? form.subtipo_intervalo : null,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      responsavel: form.responsavel.trim() || null,
      horario_inicio: form.horario_inicio || null,
      horario_fim: form.horario_fim || null,
    }

    let error
    if (editandoId) {
      ;({ error } = await supabase.from('roteiro_itens').update(payload).eq('id', editandoId))
    } else {
      payload.ordem = itens.length
      ;({ error } = await supabase.from('roteiro_itens').insert(payload))
    }

    if (error) toast('Erro ao salvar item.', 'error')
    else {
      toast(editandoId ? 'Item atualizado!' : '✅ Item adicionado!')
      cancelarEdicao()
      await carregarItens()
    }
    setSaving(false)
  }

  async function removerItem(id) {
    if (!confirm('Remover este item do roteiro?')) return
    const { error } = await supabase.from('roteiro_itens').delete().eq('id', id)
    if (error) toast('Erro ao remover item.', 'error')
    else await carregarItens()
  }

  async function moverItem(index, direcao) {
    const nova = [...itens]
    const alvo = index + direcao
    if (alvo < 0 || alvo >= nova.length) return
    ;[nova[index], nova[alvo]] = [nova[alvo], nova[index]]
    setItens(nova)
    await Promise.all(nova.map((item, i) =>
      supabase.from('roteiro_itens').update({ ordem: i }).eq('id', item.id)
    ))
  }

  function iniciarEdicao(item) {
    setEditandoId(item.id)
    setForm({
      tipo: item.tipo,
      subtipo_intervalo: item.subtipo_intervalo || 'cafe',
      titulo: item.titulo,
      descricao: item.descricao || '',
      responsavel: item.responsavel || '',
      horario_inicio: item.horario_inicio || '',
      horario_fim: item.horario_fim || '',
    })
    setMostrarForm(true)
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm({ ...EMPTY_ITEM })
    setMostrarForm(false)
  }

  function abrirNovoItem(tipo = 'item') {
    cancelarEdicao()
    setForm({ ...EMPTY_ITEM, tipo })
    setMostrarForm(true)
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="📋 Roteiro da Atividade"
      size="lg"
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {itens.length > 0 && (
              <button className="btn btn-outline btn-sm" onClick={() => gerarRoteiroHTML(atividade, itens)}>
                🖨️ Imprimir PDF
              </button>
            )}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        </div>
      }
    >
      {/* Info da atividade */}
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--azul)', fontWeight: 700, marginBottom: 4 }}>
        {atividade.titulo}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--cinza-medio)', marginBottom: 16, flexWrap: 'wrap' }}>
        {atividade.data && <span>📅 {new Date(atividade.data + 'T12:00').toLocaleDateString('pt-BR')}</span>}
        {atividade.local && <span>📍 {atividade.local}</span>}
        {atividade.hora_inicio && <span>⏰ {atividade.hora_inicio}{atividade.hora_fim ? '–' + atividade.hora_fim : ''}</span>}
      </div>

      {/* Lista de itens */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : itens.length === 0 && !mostrarForm ? (
        <div style={{
          textAlign: 'center', padding: '32px 20px',
          border: '2px dashed var(--borda)', borderRadius: 12,
          color: 'var(--cinza)', marginBottom: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 14, marginBottom: 4 }}>Nenhum item no roteiro ainda.</p>
          <p style={{ fontSize: 12 }}>Use os botões abaixo para adicionar itens ou intervalos.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {itens.map((item, index) => {
            const isIntervalo = item.tipo === 'intervalo'
            const sub = isIntervalo ? (SUBTIPOS[item.subtipo_intervalo] || SUBTIPOS.outro) : null
            const horario = item.horario_inicio
              ? `${item.horario_inicio.slice(0, 5)}${item.horario_fim ? ' – ' + item.horario_fim.slice(0, 5) : ''}`
              : null

            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${editandoId === item.id ? 'var(--dourado)' : isIntervalo ? 'var(--borda-medio)' : 'var(--borda)'}`,
                background: editandoId === item.id ? 'var(--dourado-bg)' : isIntervalo ? 'var(--creme)' : 'white',
              }}>
                <span style={{ fontSize: 11, color: 'var(--cinza)', fontWeight: 800, minWidth: 20, paddingTop: 2 }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    {isIntervalo && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                        background: sub.bg, color: sub.cor,
                      }}>
                        {sub.emoji} {sub.label}
                      </span>
                    )}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--texto)' }}>
                      {item.titulo}
                    </span>
                    {horario && (
                      <span style={{ fontSize: 11.5, color: 'var(--azul-medio)', fontWeight: 600 }}>
                        ⏰ {horario}
                      </span>
                    )}
                  </div>
                  {item.responsavel && (
                    <div style={{ fontSize: 12, color: 'var(--cinza-medio)', marginTop: 3 }}>👤 {item.responsavel}</div>
                  )}
                  {item.descricao && (
                    <div style={{ fontSize: 12, color: 'var(--cinza)', marginTop: 2 }}>{item.descricao}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moverItem(index, -1)} disabled={index === 0} title="Subir" style={{ ...btnIconStyle, opacity: index === 0 ? 0.3 : 1 }}>▲</button>
                  <button onClick={() => moverItem(index, 1)} disabled={index === itens.length - 1} title="Descer" style={{ ...btnIconStyle, opacity: index === itens.length - 1 ? 0.3 : 1 }}>▼</button>
                  <button onClick={() => iniciarEdicao(item)} title="Editar" style={btnIconStyle}>✏️</button>
                  <button onClick={() => removerItem(item.id)} title="Remover" style={{ ...btnIconStyle, color: 'var(--vermelho)' }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário */}
      {mostrarForm && (
        <div style={{
          border: `2px solid ${editandoId ? 'var(--dourado)' : 'var(--azul-claro)'}`,
          borderRadius: 12, padding: 16,
          background: editandoId ? 'var(--dourado-bg)' : 'var(--azul-suave)',
          marginBottom: 14,
        }}>
          <div style={{ fontWeight: 800, fontSize: 11.5, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>
            {editandoId ? '✏️ Editando item' : form.tipo === 'intervalo' ? '☕ Novo Intervalo' : '➕ Novo Item'}
          </div>

          {!editandoId && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={() => setForm(f => ({ ...f, tipo: 'item' }))} className={form.tipo === 'item' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}>
                📌 Item
              </button>
              <button onClick={() => setForm(f => ({ ...f, tipo: 'intervalo' }))} className={form.tipo === 'intervalo' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}>
                ☕ Intervalo
              </button>
            </div>
          )}

          {form.tipo === 'intervalo' && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {Object.entries(SUBTIPOS).map(([key, val]) => (
                <button key={key}
                  onClick={() => setForm(f => ({ ...f, subtipo_intervalo: key, titulo: f.titulo || val.label }))}
                  style={{
                    padding: '4px 12px', borderRadius: 20, border: '1.5px solid',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)',
                    borderColor: form.subtipo_intervalo === key ? '#c9a227' : 'var(--borda)',
                    background: form.subtipo_intervalo === key ? 'var(--dourado-bg)' : 'white',
                    color: form.subtipo_intervalo === key ? '#c9a227' : 'var(--cinza-medio)',
                  }}
                >
                  {val.emoji} {val.label}
                </button>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-input"
              placeholder={form.tipo === 'intervalo' ? 'Ex: Café da manhã, Almoço livre...' : 'Ex: Dinâmica de apresentação'}
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
          </div>

          <div className="form-row form-row-2" style={{ marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Horário Início</label>
              <input className="form-input" type="time" value={form.horario_inicio} onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Horário Fim</label>
              <input className="form-input" type="time" value={form.horario_fim} onChange={e => setForm(f => ({ ...f, horario_fim: e.target.value }))} />
            </div>
          </div>

          {form.tipo === 'item' && (
            <div className="form-group">
              <label className="form-label">Responsável</label>
              <input className="form-input" placeholder="Nome do responsável" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-textarea" rows={2} placeholder="Detalhes adicionais..." value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={{ minHeight: 60 }} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={cancelarEdicao}>Cancelar</button>
            <button className="btn btn-sm btn-gold" onClick={salvar} disabled={saving}>
              {saving ? '⏳...' : editandoId ? 'Salvar alterações' : '+ Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      {!mostrarForm && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={() => abrirNovoItem('item')}>+ Adicionar Item</button>
          <button className="btn btn-sm btn-outline" onClick={() => abrirNovoItem('intervalo')}>☕ Adicionar Intervalo</button>
        </div>
      )}
    </Modal>
  )
}

const btnIconStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '4px 6px', borderRadius: 6, fontSize: 13,
  color: 'var(--cinza-medio)', fontFamily: 'var(--font-body)',
}
