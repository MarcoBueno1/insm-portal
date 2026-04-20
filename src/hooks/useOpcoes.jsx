import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Contexto global de opções ─────────────────────────────────────
const OpcoesContext = createContext(null)

export function OpcoesProvider({ children }) {
  const [opcoes, setOpcoes] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('opcoes_sistema')
      .select('*')
      .order('categoria')
      .order('ordem')
      .order('valor')
    if (data) {
      const map = {}
      data.forEach(o => {
        if (!map[o.categoria]) map[o.categoria] = []
        map[o.categoria].push(o)
      })
      setOpcoes(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function adicionar(categoria, valor) {
    if (!valor?.trim()) return
    const existe = (opcoes[categoria] || []).some(o => o.valor.toLowerCase() === valor.toLowerCase().trim())
    if (existe) return { erro: 'Já existe esta opção.' }
    const ordem = (opcoes[categoria] || []).length
    const { error } = await supabase.from('opcoes_sistema').insert({ categoria, valor: valor.trim(), ordem })
    if (!error) await load()
    return error ? { erro: error.message } : {}
  }

  async function remover(id) {
    await supabase.from('opcoes_sistema').delete().eq('id', id)
    await load()
  }

  const lista = (categoria) => (opcoes[categoria] || []).map(o => o.valor)
  const completa = (categoria) => opcoes[categoria] || []

  return (
    <OpcoesContext.Provider value={{ opcoes, loading, adicionar, remover, lista, completa, reload: load }}>
      {children}
    </OpcoesContext.Provider>
  )
}

export const useOpcoes = () => useContext(OpcoesContext)

// ── SQL para criar a tabela (adicionar ao SCHEMA_SQL) ─────────────
export const OPCOES_SQL = `
-- TABELA DE OPÇÕES CONFIGURÁVEIS (comboboxes do sistema)
create table if not exists opcoes_sistema (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  valor text not null,
  ordem int default 0,
  criado_em timestamptz default now(),
  unique(categoria, valor)
);
alter table opcoes_sistema enable row level security;
create policy "auth_all" on opcoes_sistema for all using (auth.role() = 'authenticated');

-- Dados iniciais
insert into opcoes_sistema (categoria, valor, ordem) values
  -- Temas de atividades
  ('temas_atividade', 'Arte Sacra', 0),
  ('temas_atividade', 'Retiros Espirituais', 1),
  ('temas_atividade', 'Catequese', 2),
  ('temas_atividade', 'Terço & Oração', 3),
  ('temas_atividade', 'Formação Familiar', 4),
  ('temas_atividade', 'Missa das Crianças', 5),
  ('temas_atividade', 'Adoração Eucarística', 6),
  ('temas_atividade', 'Formação de Catequistas', 7),
  ('temas_atividade', 'Outro', 8),
  -- Locais de atividades
  ('locais_atividade', 'Salão Principal', 0),
  ('locais_atividade', 'Salão de Reuniões', 1),
  ('locais_atividade', 'Pátio do Instituto', 2),
  ('locais_atividade', 'Casa de Retiro', 3),
  ('locais_atividade', 'Igreja Matriz', 4),
  ('locais_atividade', 'Auditório', 5),
  -- Categorias de estoque
  ('categorias_estoque', 'Material de Arte', 0),
  ('categorias_estoque', 'Papelaria', 1),
  ('categorias_estoque', 'Limpeza', 2),
  ('categorias_estoque', 'Alimentos', 3),
  ('categorias_estoque', 'Liturgia', 4),
  ('categorias_estoque', 'Informática', 5),
  ('categorias_estoque', 'Outros', 6),
  -- Categorias de compras
  ('categorias_compra', 'Material de Arte', 0),
  ('categorias_compra', 'Papelaria', 1),
  ('categorias_compra', 'Limpeza', 2),
  ('categorias_compra', 'Alimentos', 3),
  ('categorias_compra', 'Liturgia', 4),
  ('categorias_compra', 'Informática', 5),
  ('categorias_compra', 'Outros', 6),
  -- Áreas de coordenadores e diretores
  ('areas_coordenador', 'Coordenação Geral', 0),
  ('areas_coordenador', 'Atividades & Eventos', 1),
  ('areas_coordenador', 'Catequese Infantil', 2),
  ('areas_coordenador', 'Compras & Materiais', 3),
  ('areas_coordenador', 'Orientação Espiritual', 4),
  ('areas_coordenador', 'Finanças & Contas', 5),
  ('areas_coordenador', 'Comunicação', 6),
  -- Áreas de diretores
  ('areas_diretor', 'Direção Geral', 0),
  ('areas_diretor', 'Direção Pedagógica', 1),
  ('areas_diretor', 'Direção Administrativa', 2),
  ('areas_diretor', 'Direção Financeira', 3),
  ('areas_diretor', 'Direção Espiritual', 4),
  -- Tarefas padrão para responsáveis
  ('tipos_tarefa', 'Organizar o espaço', 0),
  ('tipos_tarefa', 'Comprar materiais', 1),
  ('tipos_tarefa', 'Liderar a equipe', 2),
  ('tipos_tarefa', 'Comunicar participantes', 3),
  ('tipos_tarefa', 'Preparar liturgia', 4),
  ('tipos_tarefa', 'Registrar presença', 5),
  ('tipos_tarefa', 'Fotografar o evento', 6),
  ('tipos_tarefa', 'Preparar lanche', 7),
  ('tipos_tarefa', 'Conduzir atividade', 8),
  -- Unidades de estoque
  ('unidades_estoque', 'un', 0),
  ('unidades_estoque', 'cx', 1),
  ('unidades_estoque', 'pacote', 2),
  ('unidades_estoque', 'resma', 3),
  ('unidades_estoque', 'kg', 4),
  ('unidades_estoque', 'L', 5),
  ('unidades_estoque', 'par', 6),
  ('unidades_estoque', 'rolo', 7)
on conflict (categoria, valor) do nothing;
`
