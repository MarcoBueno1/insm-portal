import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useToast } from '../hooks/useToast'
import Modal from '../components/Modal'

export const PERFIS = [
  {
    value: 'leitura',
    label: '👁️ Leitura',
    desc: 'Apenas visualiza — não cria, edita ou exclui nada.',
    cor: 'var(--cinza)',
    bg: 'var(--cinza-cl)',
    permissoes: ['Ver dashboard', 'Ver mural', 'Ver coordenadores', 'Ver atividades', 'Ver registros', 'Ver métricas', 'Ver estoque', 'Ver compras'],
  },
  {
    value: 'coord',
    label: '✏️ Coordenador',
    desc: 'Gerencia atividades, estoque, compras e registros.',
    cor: '#7a5a00',
    bg: 'var(--dourado-bg)',
    permissoes: ['Tudo de Leitura', 'Publicar avisos no mural', 'Cadastrar coordenadores', 'Criar e editar atividades', 'Marcar atividades como realizadas', 'Upload de fotos e documentos', 'Movimentar estoque', 'Cadastrar itens no estoque', 'Registrar compras'],
  },
  {
    value: 'admin',
    label: '⭐ Administrador',
    desc: 'Acesso total, incluindo gestão de usuários e perfis.',
    cor: 'var(--azul)',
    bg: 'var(--azul-suave)',
    permissoes: ['Tudo de Coordenador', 'Pré-aprovar e-mails', 'Suspender / reativar acessos', 'Alterar perfil de qualquer usuário', 'Remover usuários', 'Excluir qualquer registro'],
  },
]

const EMPTY_FORM = { nome: '', email: '', perfil: 'leitura' }

// ── Avatares coloridos por inicial ──────────────────────────────
const AVATAR_CORES = [
  ['#1a3a6b','#4a7fcb'], ['#2e7d52','#52c27d'], ['#7b2fa0','#c29ee0'],
  ['#c9a227','#e8c547'], ['#d4680a','#f0a940'], ['#c0392b','#e74c3c'],
]
function avatarCor(str) {
  const idx = (str?.charCodeAt(0) || 0) % AVATAR_CORES.length
  return AVATAR_CORES[idx]
}
function Inicial({ nome, email, size = 36 }) {
  const txt = (nome || email || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const [c1, c2] = avatarCor(txt)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg,${c1},${c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: '800', fontSize: size * 0.36,
      fontFamily: 'var(--font-body)', letterSpacing: '-0.5px',
    }}>{txt}</div>
  )
}

// ── Card de perfil clicável ──────────────────────────────────────
function PerfilCard({ perfil, selecionado, onClick }) {
  const ativo = selecionado === perfil.value
  return (
    <div onClick={onClick} style={{
      border: `2px solid ${ativo ? 'var(--azul-claro)' : 'var(--borda)'}`,
      borderRadius: '12px', padding: '14px 16px', cursor: 'pointer',
      background: ativo ? 'var(--azul-suave)' : 'white',
      transition: 'all 0.18s', marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: `2px solid ${ativo ? 'var(--azul-medio)' : 'var(--borda)'}`, background: ativo ? 'var(--azul-medio)' : 'white', flexShrink: 0, transition: 'all 0.15s' }} />
        <span style={{ fontWeight: '800', fontSize: '14px', color: ativo ? 'var(--azul)' : 'var(--texto)' }}>{perfil.label}</span>
      </div>
      <p style={{ fontSize: '12.5px', color: 'var(--cinza-medio)', marginLeft: '20px', marginBottom: '10px' }}>{perfil.desc}</p>
      <div style={{ marginLeft: '20px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {perfil.permissoes.map(p => (
          <span key={p} style={{ fontSize: '11px', background: ativo ? `${perfil.bg}` : 'var(--cinza-cl)', color: ativo ? perfil.cor : 'var(--cinza-medio)', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>
            {p.startsWith('Tudo') ? <strong>{p}</strong> : p}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { isAdmin, user: authUser } = useAuth()
  const toast = useToast()
  const [aprovados, setAprovados] = useState([])
  const [perfisAtivos, setPerfisAtivos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState('aprovados')
  const [busca, setBusca]         = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)   // objeto aprovado a editar
  const [modalDetalhes, setModalDetalhes] = useState(null) // usuário ativo a ver
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  async function load() {
    setLoading(true)
    const [apRes, pfRes] = await Promise.all([
      supabase.from('usuarios_aprovados').select('*').order('nome'),
      supabase.from('perfis').select('*').order('nome'),
    ])
    setAprovados(apRes.data || [])
    setPerfisAtivos(pfRes.data || [])
    setLoading(false)
  }

  // ── Pré-aprovar novo e-mail ────────────────────────────────────
  async function salvarNovo() {
    if (!form.nome.trim()) { toast('Informe o nome.', 'error'); return }
    if (!/\S+@\S+\.\S+/.test(form.email)) { toast('E-mail inválido.', 'error'); return }
    // verifica duplicata
    const jaExiste = aprovados.some(a => a.email === form.email.toLowerCase().trim())
    if (jaExiste) { toast('Este e-mail já está na lista.', 'warning'); return }
    setSaving(true)
    const { error } = await supabase.from('usuarios_aprovados').insert({
      nome: form.nome.trim(),
      email: form.email.toLowerCase().trim(),
      perfil: form.perfil,
      ativo: true,
    })
    if (error) toast('Erro: ' + error.message, 'error')
    else {
      toast(`✅ ${form.nome} pré-aprovado! Já pode criar a conta.`)
      setModalOpen(false)
      setForm(EMPTY_FORM)
      load()
    }
    setSaving(false)
  }

  // ── Salvar edição de aprovado ──────────────────────────────────
  async function salvarEdicao() {
    if (!form.nome.trim()) { toast('Informe o nome.', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('usuarios_aprovados')
      .update({ nome: form.nome.trim(), perfil: form.perfil })
      .eq('id', modalEditar.id)
    // Atualiza também o perfil na tabela perfis (se o usuário já se cadastrou)
    const perfilAtivo = perfisAtivos.find(p => p.email === modalEditar.email)
    if (perfilAtivo) {
      await supabase.from('perfis').update({ perfil: form.perfil, nome: form.nome.trim() }).eq('id', perfilAtivo.id)
    }
    if (error) toast('Erro: ' + error.message, 'error')
    else { toast('Cadastro atualizado!'); setModalEditar(null); load() }
    setSaving(false)
  }

  // ── Suspender / Reativar ───────────────────────────────────────
  async function toggleAtivo(ap) {
    const novoAtivo = !ap.ativo
    await supabase.from('usuarios_aprovados').update({ ativo: novoAtivo }).eq('id', ap.id)
    toast(novoAtivo ? `▶ Acesso de ${ap.nome} reativado.` : `⏸ Acesso de ${ap.nome} suspenso.`)
    load()
  }

  // ── Remover aprovado ──────────────────────────────────────────
  async function remover(ap) {
    // Impede remover a si mesmo
    if (ap.email === authUser?.email) { toast('Você não pode remover seu próprio acesso.', 'error'); return }
    if (!confirm(`Remover "${ap.nome}" (${ap.email}) da lista de aprovados?\n\nSe já tiver conta criada, o usuário não conseguirá fazer login.`)) return
    await supabase.from('usuarios_aprovados').delete().eq('id', ap.id)
    toast(`${ap.nome} removido da lista.`)
    load()
  }

  // ── Alterar perfil direto na listagem ─────────────────────────
  async function alterarPerfil(ap, novoPerfil) {
    if (ap.email === authUser?.email && novoPerfil !== 'admin') {
      toast('Você não pode rebaixar seu próprio perfil de administrador.', 'error'); return
    }
    await supabase.from('usuarios_aprovados').update({ perfil: novoPerfil }).eq('id', ap.id)
    const perfilAtivo = perfisAtivos.find(p => p.email === ap.email)
    if (perfilAtivo) {
      await supabase.from('perfis').update({ perfil: novoPerfil }).eq('id', perfilAtivo.id)
    }
    toast(`Perfil de ${ap.nome} alterado para ${PERFIS.find(p => p.value === novoPerfil)?.label}.`)
    load()
  }

  // ── Filtro de busca ───────────────────────────────────────────
  const aprovadosFiltrados = aprovados.filter(a =>
    !busca ||
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    a.email.toLowerCase().includes(busca.toLowerCase())
  )
  const perfisFiltrados = perfisAtivos.filter(p =>
    !busca ||
    (p.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (p.email || '').toLowerCase().includes(busca.toLowerCase())
  )

  // ── Estatísticas ─────────────────────────────────────────────
  const stats = {
    total:    aprovados.length,
    ativos:   aprovados.filter(a => a.ativo).length,
    suspensos:aprovados.filter(a => !a.ativo).length,
    admins:   aprovados.filter(a => a.perfil === 'admin').length,
    coords:   aprovados.filter(a => a.perfil === 'coord').length,
    leituras: aprovados.filter(a => a.perfil === 'leitura').length,
    cadastrados: perfisAtivos.length,
  }

  // ── Sem permissão ────────────────────────────────────────────
  if (!isAdmin) return (
    <div className="empty-state" style={{ paddingTop: '80px' }}>
      <span className="empty-icon">🔒</span>
      <h3>Acesso Restrito</h3>
      <p>Apenas administradores podem gerenciar usuários.</p>
    </div>
  )

  return (
    <div className="animate-in">

      {/* ── Cabeçalho ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🔐 Usuários & Controle de Acesso</h1>
          <p className="page-subtitle">Pré-aprove e gerencie quem pode acessar o sistema</p>
        </div>
        <div className="page-actions">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input placeholder="Buscar por nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <button className="btn btn-gold" onClick={() => { setForm(EMPTY_FORM); setModalOpen(true) }}>
            + Pré-aprovar Pessoa
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { icon: '👥', val: stats.total,       label: 'Total Aprovados', cor: 'var(--azul)' },
          { icon: '✅', val: stats.ativos,      label: 'Com Acesso Ativo', cor: 'var(--verde)' },
          { icon: '⏸', val: stats.suspensos,   label: 'Suspensos', cor: 'var(--laranja)' },
          { icon: '⭐', val: stats.admins,      label: 'Administradores', cor: 'var(--azul)' },
          { icon: '✏️', val: stats.coords,      label: 'Coordenadores', cor: '#7a5a00' },
          { icon: '👤', val: stats.cadastrados, label: 'Já Cadastrados', cor: 'var(--verde)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid var(--borda)', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', color: s.cor, lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--cinza)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Como funciona ── */}
      <div className="alert alert-gold" style={{ marginBottom: '20px' }}>
        <span className="alert-icon">⭐</span>
        <div style={{ fontSize: '13px' }}>
          <strong>Como funciona o acesso:</strong> Você pré-aprova o e-mail aqui e define o perfil →
          A pessoa acessa o site e cria a conta com esse e-mail (via Google ou senha) →
          O sistema reconhece e libera o acesso automaticamente com o perfil definido.
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button className={`tab ${tab === 'aprovados' ? 'active' : ''}`} onClick={() => setTab('aprovados')}>
          📋 E-mails Aprovados ({aprovados.length})
        </button>
        <button className={`tab ${tab === 'ativos' ? 'active' : ''}`} onClick={() => setTab('ativos')}>
          👥 Já Cadastrados ({perfisAtivos.length})
        </button>
        <button className={`tab ${tab === 'perfis' ? 'active' : ''}`} onClick={() => setTab('perfis')}>
          🎭 Perfis de Acesso
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <>
          {/* ════ ABA: APROVADOS ════ */}
          {tab === 'aprovados' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 Lista de E-mails Pré-aprovados</span>
                <span style={{ fontSize: '12px', color: 'var(--cinza-medio)' }}>
                  {aprovadosFiltrados.length} {aprovadosFiltrados.length === 1 ? 'pessoa' : 'pessoas'}
                </span>
              </div>

              {aprovadosFiltrados.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📧</span>
                  <h3>{busca ? 'Nenhum resultado para a busca' : 'Nenhuma pessoa aprovada ainda'}</h3>
                  <p>{busca ? 'Tente outro nome ou e-mail.' : 'Adicione o primeiro e-mail para liberar acesso.'}</p>
                  {!busca && <button className="btn btn-gold" onClick={() => { setForm(EMPTY_FORM); setModalOpen(true) }}>Pré-aprovar primeira pessoa</button>}
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pessoa</th>
                        <th>E-mail</th>
                        <th>Perfil de Acesso</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ textAlign: 'center' }}>Já Cadastrou?</th>
                        <th>Aprovado em</th>
                        <th style={{ textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aprovadosFiltrados.map(ap => {
                        const jaCadastrou = perfisAtivos.some(p => p.email === ap.email)
                        const eSiMesmo = ap.email === authUser?.email
                        const perfilInfo = PERFIS.find(p => p.value === ap.perfil)
                        return (
                          <tr key={ap.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Inicial nome={ap.nome} email={ap.email} size={34} />
                                <div>
                                  <div style={{ fontWeight: '700', fontSize: '13.5px' }}>
                                    {ap.nome}
                                    {eSiMesmo && <span style={{ fontSize: '10px', background: 'var(--azul)', color: 'white', padding: '1px 6px', borderRadius: '10px', marginLeft: '6px', fontWeight: '700' }}>Você</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: '12.5px', color: 'var(--cinza-medio)' }}>{ap.email}</td>
                            <td>
                              {/* Seletor de perfil inline */}
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {PERFIS.map(p => (
                                  <button key={p.value}
                                    disabled={eSiMesmo && p.value !== 'admin'}
                                    onClick={() => ap.perfil !== p.value && alterarPerfil(ap, p.value)}
                                    title={p.desc}
                                    style={{
                                      padding: '4px 10px', borderRadius: '16px', border: '1.5px solid',
                                      fontSize: '11.5px', fontWeight: '700', cursor: (eSiMesmo && p.value !== 'admin') ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.15s',
                                      borderColor: ap.perfil === p.value ? 'var(--azul-claro)' : 'var(--borda)',
                                      background: ap.perfil === p.value ? p.bg : 'white',
                                      color: ap.perfil === p.value ? p.cor : 'var(--cinza)',
                                      opacity: (eSiMesmo && p.value !== 'admin') ? 0.4 : 1,
                                    }}>
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${ap.ativo ? 'badge-ativo' : 'badge-pendente'}`}>
                                {ap.ativo ? '✅ Ativo' : '⏸ Suspenso'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {jaCadastrou
                                ? <span className="badge badge-ativo">✅ Sim</span>
                                : <span className="badge badge-pendente">⏳ Não</span>}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--cinza)', whiteSpace: 'nowrap' }}>
                              {new Date(ap.criado_em).toLocaleDateString('pt-BR')}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                {/* Editar */}
                                <button className="btn btn-sm btn-outline"
                                  title="Editar nome e perfil"
                                  onClick={() => { setForm({ nome: ap.nome, email: ap.email, perfil: ap.perfil }); setModalEditar(ap) }}>
                                  ✏️
                                </button>
                                {/* Suspender / Reativar */}
                                {!eSiMesmo && (
                                  <button
                                    className={`btn btn-sm ${ap.ativo ? 'btn-ghost' : 'btn-success'}`}
                                    title={ap.ativo ? 'Suspender acesso' : 'Reativar acesso'}
                                    onClick={() => toggleAtivo(ap)}>
                                    {ap.ativo ? '⏸' : '▶'}
                                  </button>
                                )}
                                {/* Remover */}
                                {!eSiMesmo && (
                                  <button className="btn btn-sm btn-danger" title="Remover" onClick={() => remover(ap)}>🗑</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════ ABA: JÁ CADASTRADOS ════ */}
          {tab === 'ativos' && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">👥 Pessoas que Já Criaram Conta</span>
                <span style={{ fontSize: '12px', color: 'var(--cinza-medio)' }}>{perfisFiltrados.length} {perfisFiltrados.length === 1 ? 'usuário' : 'usuários'}</span>
              </div>

              {perfisFiltrados.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">👥</span>
                  <h3>{busca ? 'Nenhum resultado' : 'Nenhum usuário cadastrado ainda'}</h3>
                  <p>As pessoas aparecem aqui após criarem a conta no sistema.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', padding: '20px' }}>
                  {perfisFiltrados.map(p => {
                    const ap = aprovados.find(a => a.email === p.email)
                    const eSiMesmo = p.email === authUser?.email
                    const perfilInfo = PERFIS.find(pf => pf.value === (p.perfil || 'leitura'))
                    return (
                      <div key={p.id} style={{
                        background: 'white', borderRadius: '14px', padding: '18px',
                        border: '1px solid var(--borda)', boxShadow: 'var(--shadow)',
                        display: 'flex', flexDirection: 'column', gap: '12px',
                        transition: 'all 0.2s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                      >
                        {/* Cabeçalho do card */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Inicial nome={p.nome} email={p.email} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--azul)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {p.nome || '—'}
                              {eSiMesmo && <span style={{ fontSize: '9.5px', background: 'var(--azul)', color: 'white', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>Você</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--cinza-medio)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                          </div>
                        </div>

                        {/* Perfil atual */}
                        <div style={{ background: perfilInfo?.bg || 'var(--cinza-cl)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '700', color: perfilInfo?.cor || 'var(--cinza)' }}>{perfilInfo?.label}</span>
                          <span style={{ fontSize: '11px', color: 'var(--cinza-medio)' }}>
                            Desde {p.criado_em ? new Date(p.criado_em).toLocaleDateString('pt-BR') : '—'}
                          </span>
                        </div>

                        {/* Alterar perfil */}
                        {!eSiMesmo && ap && (
                          <div>
                            <div style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Alterar Perfil</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {PERFIS.map(pf => (
                                <button key={pf.value}
                                  onClick={() => p.perfil !== pf.value && alterarPerfil(ap, pf.value)}
                                  style={{
                                    flex: 1, padding: '5px 4px', borderRadius: '7px',
                                    border: `1.5px solid ${(p.perfil || 'leitura') === pf.value ? 'var(--azul-claro)' : 'var(--borda)'}`,
                                    background: (p.perfil || 'leitura') === pf.value ? pf.bg : 'white',
                                    color: (p.perfil || 'leitura') === pf.value ? pf.cor : 'var(--cinza)',
                                    fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                                    transition: 'all 0.15s', fontFamily: 'var(--font-body)',
                                  }}>
                                  {pf.label.split(' ')[0]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Status de acesso */}
                        {ap && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--borda)' }}>
                            <span className={`badge ${ap.ativo ? 'badge-ativo' : 'badge-pendente'}`}>
                              {ap.ativo ? '✅ Acesso Ativo' : '⏸ Suspenso'}
                            </span>
                            {!eSiMesmo && (
                              <button className={`btn btn-sm ${ap.ativo ? 'btn-ghost' : 'btn-success'}`}
                                onClick={() => toggleAtivo(ap)} style={{ fontSize: '11.5px' }}>
                                {ap.ativo ? '⏸ Suspender' : '▶ Reativar'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════ ABA: PERFIS ════ */}
          {tab === 'perfis' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
              {PERFIS.map(p => (
                <div key={p.value} style={{
                  background: 'white', borderRadius: '16px', overflow: 'hidden',
                  boxShadow: 'var(--shadow)', border: '1px solid var(--borda)',
                }}>
                  {/* Cabeçalho colorido */}
                  <div style={{ padding: '20px 22px', background: p.bg, borderBottom: `3px solid ${p.cor}` }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color: p.cor, marginBottom: '4px' }}>{p.label}</div>
                    <p style={{ fontSize: '13px', color: p.cor, opacity: 0.8 }}>{p.desc}</p>
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: p.cor }}>
                        {aprovados.filter(a => a.perfil === p.value).length} pessoa(s) com este perfil
                      </span>
                    </div>
                  </div>
                  {/* Permissões */}
                  <div style={{ padding: '18px 22px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Permissões</div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {p.permissoes.map(perm => (
                        <li key={perm} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--texto)' }}>
                          <span style={{ color: 'var(--verde)', fontWeight: '800', flexShrink: 0, marginTop: '1px' }}>✓</span>
                          <span>{perm}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Pessoas com este perfil */}
                  {aprovados.filter(a => a.perfil === p.value).length > 0 && (
                    <div style={{ padding: '14px 22px', borderTop: '1px solid var(--borda)', background: 'var(--creme)' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--cinza)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Pessoas</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aprovados.filter(a => a.perfil === p.value).map(a => (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Inicial nome={a.nome} email={a.email} size={26} />
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--azul)' }}>{a.nome}</div>
                              <div style={{ fontSize: '11px', color: 'var(--cinza)' }}>{a.email}</div>
                            </div>
                            {!a.ativo && <span className="badge badge-pendente" style={{ marginLeft: 'auto', fontSize: '10px' }}>⏸</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════ MODAL: PRÉ-APROVAR NOVO ════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title="✦ Pré-aprovar Acesso ao Sistema"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvarNovo} disabled={saving}>
            {saving ? '⏳ Salvando...' : '✅ Pré-aprovar Acesso'}
          </button>
        </>}
      >
        <div className="alert alert-blue" style={{ marginBottom: '20px' }}>
          <span className="alert-icon">ℹ️</span>
          <div style={{ fontSize: '12.5px', lineHeight: '1.6' }}>
            Após cadastrar, a pessoa poderá acessar o site e criar a conta usando
            este e-mail — via <strong>Google</strong> (um clique) ou <strong>e-mail + senha</strong>.
            O perfil pode ser alterado a qualquer momento.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Nome Completo *</label>
          <input className="form-input" placeholder="Ex: Irmã Maria das Graças"
            value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">E-mail *</label>
          <input className="form-input" type="email" placeholder="usuario@email.com"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>

        <div className="form-group" style={{ marginTop: '4px' }}>
          <label className="form-label" style={{ marginBottom: '10px' }}>Perfil de Acesso</label>
          {PERFIS.map(p => <PerfilCard key={p.value} perfil={p} selecionado={form.perfil} onClick={() => setForm(f => ({ ...f, perfil: p.value }))} />)}
        </div>
      </Modal>

      {/* ════ MODAL: EDITAR APROVADO ════ */}
      <Modal open={!!modalEditar} onClose={() => setModalEditar(null)}
        title="✏️ Editar Cadastro de Acesso"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setModalEditar(null)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvarEdicao} disabled={saving}>
            {saving ? '⏳ Salvando...' : 'Salvar Alterações'}
          </button>
        </>}
      >
        {modalEditar && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--creme)', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--borda)' }}>
              <Inicial nome={modalEditar.nome} email={modalEditar.email} size={42} />
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--azul)' }}>{modalEditar.nome}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--cinza-medio)' }}>{modalEditar.email}</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <input className="form-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginTop: '4px' }}>
              <label className="form-label" style={{ marginBottom: '10px' }}>Perfil de Acesso</label>
              {PERFIS.map(p => <PerfilCard key={p.value} perfil={p} selecionado={form.perfil} onClick={() => setForm(f => ({ ...f, perfil: p.value }))} />)}
            </div>
          </>
        )}
      </Modal>

    </div>
  )
}
