import React, { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Mural from './pages/Mural'
import Coordenadores from './pages/Coordenadores'
import Atividades from './pages/Atividades'
import Registros from './pages/Registros'
import Metricas from './pages/Metricas'
import Estoque from './pages/Estoque'
import Materiais from './pages/Materiais'
import Usuarios from './pages/Usuarios'
import { ToastProvider } from './hooks/useToast'

// ---- Auth Context ----
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPerfil(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadPerfil(session.user.id)
      else { setPerfil(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPerfil(userId) {
    try {
      const { data } = await supabase.from('perfis').select('*').eq('id', userId).single()
      setPerfil(data)
    } catch (e) {
      // perfil pode não existir ainda, cria um padrão
      setPerfil({ perfil: 'leitura' })
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = perfil?.perfil === 'admin'
  const isCoord = perfil?.perfil === 'coord' || isAdmin
  const nomeUser = perfil?.nome || user?.email?.split('@')[0] || 'Usuário'

  return (
    <AuthContext.Provider value={{ user, perfil, loading, isAdmin, isCoord, nomeUser }}>
      {children}
    </AuthContext.Provider>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-center">
        <div className="spinner" />
        <span>Carregando...</span>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="mural" element={<Mural />} />
              <Route path="coordenadores" element={<Coordenadores />} />
              <Route path="atividades" element={<Atividades />} />
              <Route path="registros" element={<Registros />} />
              <Route path="metricas" element={<Metricas />} />
              <Route path="estoque" element={<Estoque />} />
              <Route path="materiais" element={<Materiais />} />
              <Route path="usuarios" element={<Usuarios />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
