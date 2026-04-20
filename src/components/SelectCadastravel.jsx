import React, { useState } from 'react'
import { useOpcoes } from '../hooks/useOpcoes'
import { useAuth } from '../App'

/**
 * SelectCadastravelConteudo — dropdown com gerenciamento de opções inline
 * Props:
 *   categoria: string (chave na tabela opcoes_sistema)
 *   value, onChange: estado controlado
 *   placeholder: string
 *   className: string (CSS class para o select)
 */
export default function SelectCadastravel({ categoria, value, onChange, placeholder, className = 'form-select', style = {} }) {
  const { lista, completa, adicionar, remover } = useOpcoes()
  const { isAdmin, isCoord } = useAuth()
  const [gerenciar, setGerenciar] = useState(false)
  const [nova, setNova] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const opcoesLista = lista(categoria)
  const opcoesFull = completa(categoria)
  const podeGerenciar = isAdmin || isCoord

  async function handleAdicionar() {
    if (!nova.trim()) return
    setSalvando(true)
    setErro('')
    const res = await adicionar(categoria, nova.trim())
    if (res?.erro) setErro(res.erro)
    else { setNova(''); }
    setSalvando(false)
  }

  async function handleRemover(id, val) {
    if (val === value) onChange('')
    await remover(id)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select
          className={className}
          style={{ flex: 1, ...style }}
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {opcoesLista.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
        {podeGerenciar && (
          <button
            type="button"
            title="Gerenciar opções"
            onClick={() => setGerenciar(g => !g)}
            style={{
              background: gerenciar ? 'var(--azul)' : 'var(--cinza-cl)',
              color: gerenciar ? 'white' : 'var(--cinza-medio)',
              border: '1.5px solid var(--borda)',
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              fontSize: 14,
              flexShrink: 0,
              transition: 'all .18s',
            }}
          >⚙️</button>
        )}
      </div>

      {gerenciar && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'white', border: '1.5px solid var(--azul-claro)',
          borderRadius: 10, boxShadow: '0 8px 28px rgba(26,58,107,.18)',
          padding: '14px', marginTop: 4,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
            ⚙️ Gerenciar Opções
          </div>

          {/* Lista existente */}
          <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {opcoesFull.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--cinza)', textAlign: 'center', padding: '8px 0' }}>Nenhuma opção cadastrada.</div>
            )}
            {opcoesFull.map(op => (
              <div key={op.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', background: 'var(--cinza-cl)', borderRadius: 7,
              }}>
                <span style={{ fontSize: 13, color: 'var(--texto)', fontWeight: 600 }}>{op.valor}</span>
                <button
                  type="button"
                  onClick={() => handleRemover(op.id, op.valor)}
                  style={{ background: 'var(--vermelho)', color: 'white', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 12 }}
                >🗑</button>
              </div>
            ))}
          </div>

          {/* Adicionar nova */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={nova}
              onChange={e => { setNova(e.target.value); setErro('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
              placeholder="Nova opção..."
              style={{ flex: 1, padding: '7px 10px', border: '1.5px solid var(--borda)', borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none' }}
            />
            <button
              type="button"
              onClick={handleAdicionar}
              disabled={salvando || !nova.trim()}
              style={{ background: 'var(--verde)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: (!nova.trim() || salvando) ? .5 : 1 }}
            >+ Add</button>
          </div>
          {erro && <div style={{ fontSize: 11.5, color: 'var(--vermelho)', marginTop: 5 }}>{erro}</div>}

          <button type="button" onClick={() => setGerenciar(false)} style={{ marginTop: 10, width: '100%', background: 'none', border: '1px solid var(--borda)', borderRadius: 7, padding: '6px', cursor: 'pointer', fontSize: 12, color: 'var(--cinza-medio)', fontFamily: 'var(--font-body)' }}>
            Fechar ✕
          </button>
        </div>
      )}
    </div>
  )
}
