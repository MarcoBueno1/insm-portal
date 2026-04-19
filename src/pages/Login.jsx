import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [modo, setModo] = useState('login') // login | cadastro | recuperar

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user])

  async function verificarEmailAprovado(email) {
    const { data } = await supabase
      .from('usuarios_aprovados')
      .select('ativo')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .maybeSingle()
    return !!data
  }

  async function handleLogin(e) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const aprovado = await verificarEmailAprovado(email)
      if (!aprovado) {
        setErro('Este e-mail não está pré-aprovado. Contate o administrador.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) throw error
    } catch (err) {
      setErro(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : err.message)
    } finally { setLoading(false) }
  }

  async function handleCadastro(e) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const aprovado = await verificarEmailAprovado(email)
      if (!aprovado) {
        setErro('Este e-mail não está pré-aprovado. Contate o administrador.')
        return
      }
      const { error } = await supabase.auth.signUp({ email, password: senha })
      if (error) throw error
      setErro('')
      alert('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      setModo('login')
    } catch (err) {
      setErro(err.message)
    } finally { setLoading(false) }
  }

  async function handleGoogle() {
    setErro(''); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (error) throw error
    } catch (err) {
      setErro('Erro ao conectar com Google: ' + err.message)
      setLoading(false)
    }
  }

  async function handleRecuperar(e) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      alert('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      setModo('login')
    } catch (err) {
      setErro(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1f42 0%, #1a3a6b 45%, #2a5298 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Padrão de fundo */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c9a227' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
        opacity: 0.7,
      }} />

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.98)',
        borderRadius: '24px',
        padding: '44px 44px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 28px 90px rgba(0,0,0,0.4)',
        position: 'relative',
        animation: 'slide-up 0.5s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '46px', marginBottom: '8px', filter: 'drop-shadow(0 2px 8px rgba(201,162,39,0.4))' }}>✦</div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '22px',
            color: 'var(--azul)',
            fontWeight: '700',
            lineHeight: '1.3',
            marginBottom: '4px',
          }}>Instituto Nossa<br />Senhora Menina</h1>
          <div style={{ fontSize: '10.5px', color: 'var(--cinza)', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: '700' }}>
            Portal Administrativo
          </div>
          <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, var(--dourado), transparent)', margin: '18px 0 0' }} />
        </div>

        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '19px',
          color: 'var(--azul)',
          textAlign: 'center',
          marginBottom: '22px',
        }}>
          {modo === 'login' ? 'Bem-vinda ao Portal' : modo === 'cadastro' ? 'Criar Conta' : 'Recuperar Senha'}
        </h2>

        {/* Google */}
        {modo !== 'recuperar' && (
          <>
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: 'white',
                border: '1.5px solid var(--borda)', borderRadius: '10px',
                fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: '600',
                color: 'var(--texto)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'all 0.2s', marginBottom: '14px',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--azul-claro)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(26,58,107,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--borda)'; e.currentTarget.style.boxShadow = '' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>
            <div style={{ textAlign: 'center', color: 'var(--cinza)', fontSize: '12px', marginBottom: '16px' }}>— ou use e-mail e senha —</div>
          </>
        )}

        {/* Form */}
        <form onSubmit={modo === 'login' ? handleLogin : modo === 'cadastro' ? handleCadastro : handleRecuperar}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          {modo !== 'recuperar' && (
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required minLength="6" />
            </div>
          )}

          {erro && (
            <div className="alert alert-red" style={{ marginBottom: '14px' }}>
              <span className="alert-icon">⚠️</span>
              <span>{erro}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? '⏳ Aguarde...' : modo === 'login' ? 'Entrar no Portal ✦' : modo === 'cadastro' ? 'Criar Minha Conta' : 'Enviar Link de Recuperação'}
          </button>
        </form>

        {/* Links */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {modo === 'login' && <>
            <button onClick={() => { setModo('cadastro'); setErro('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--azul-claro)', fontSize: '12.5px', fontFamily: 'var(--font-body)', fontWeight: '600' }}>
              Primeiro acesso? Criar conta
            </button>
            <button onClick={() => { setModo('recuperar'); setErro('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cinza)', fontSize: '12px', fontFamily: 'var(--font-body)' }}>
              Esqueci minha senha
            </button>
          </>}
          {modo !== 'login' && (
            <button onClick={() => { setModo('login'); setErro('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--azul-claro)', fontSize: '12.5px', fontFamily: 'var(--font-body)', fontWeight: '600' }}>
              ← Voltar ao login
            </button>
          )}
          <p style={{ color: 'var(--cinza)', fontSize: '11px', marginTop: '6px', lineHeight: '1.6' }}>
            🔒 Acesso restrito a membros pré-aprovados.<br />
            Solicitações: fale com o administrador.
          </p>
        </div>
      </div>
    </div>
  )
}
