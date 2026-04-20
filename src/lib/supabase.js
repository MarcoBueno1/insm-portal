import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================
// SQL PARA EXECUTAR NO SUPABASE SQL EDITOR (uma vez só)
// Dashboard → SQL Editor → New Query → Cole e execute
// ============================================================
export const SCHEMA_SQL = `
-- 1. USUÁRIOS PRÉ-APROVADOS
create table if not exists usuarios_aprovados (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nome text not null,
  perfil text not null default 'leitura', -- 'admin', 'coord', 'leitura'
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 2. PERFIS DE USUÁRIO (complementa auth.users)
create table if not exists perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  perfil text default 'leitura',
  avatar_url text,
  criado_em timestamptz default now()
);

-- 3. MURAL DE AVISOS
create table if not exists mural (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text not null,
  tipo text default 'aviso', -- aviso, urgente, info, conquista
  autor_id uuid references perfis(id),
  autor_nome text,
  fixado boolean default false,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 4. COORDENADORES
create table if not exists coordenadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  area text not null,
  descricao text,
  whatsapp text,
  email text,
  foto_url text,
  ordem int default 0,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 5. ATIVIDADES
create table if not exists atividades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  data date not null,
  hora_inicio time,
  hora_fim time,
  local text,
  tema text,
  descricao text,
  qtd_criancas int default 0,
  qtd_adultos int default 0,
  insumos text,
  status text default 'planejada', -- planejada, realizada, cancelada
  gcal_event_id text,
  criado_por uuid references perfis(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- 6. REGISTROS DE ATIVIDADE (fotos, docs, lista presença)
create table if not exists registros (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid references atividades(id) on delete cascade,
  tipo text, -- foto, documento, lista_presenca
  nome text,
  arquivo_url text,
  descricao text,
  tamanho_bytes bigint,
  criado_por uuid references perfis(id),
  criado_em timestamptz default now()
);

-- 7. LISTA DE PRESENÇA
create table if not exists lista_presenca (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid references atividades(id) on delete cascade,
  nome text not null,
  tipo text default 'crianca', -- crianca, adulto
  presente boolean default false,
  ordem int default 0
);

-- 8. ESTOQUE
create table if not exists estoque (
  id uuid primary key default gen_random_uuid(),
  produto text not null,
  categoria text,
  qtd_atual numeric default 0,
  qtd_minima numeric default 0,
  unidade text default 'un',
  observacao text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- 9. MOVIMENTAÇÕES DE ESTOQUE
create table if not exists movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid references estoque(id) on delete cascade,
  tipo text not null, -- entrada, saida
  quantidade numeric not null,
  motivo text,
  usuario_id uuid references perfis(id),
  criado_em timestamptz default now()
);

-- 10. COMPRAS DE MATERIAIS
create table if not exists compras (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  item text not null,
  categoria text,
  quantidade numeric default 1,
  valor_unitario numeric default 0,
  valor_total numeric generated always as (quantidade * valor_unitario) stored,
  atividade_id uuid references atividades(id),
  atividade_nome text,
  responsavel text,
  nota_url text,
  observacao text,
  criado_por uuid references perfis(id),
  criado_em timestamptz default now()
);

-- RLS (Row Level Security) - todos os autenticados podem ler e escrever
alter table usuarios_aprovados enable row level security;
alter table mural enable row level security;
alter table coordenadores enable row level security;
alter table atividades enable row level security;
alter table registros enable row level security;
alter table lista_presenca enable row level security;
alter table estoque enable row level security;
alter table movimentacoes_estoque enable row level security;
alter table compras enable row level security;
alter table perfis enable row level security;

-- Policies básicas (autenticados têm acesso total - ajuste conforme perfil depois)
create policy "auth_all" on mural for all using (auth.role() = 'authenticated');
create policy "auth_all" on coordenadores for all using (auth.role() = 'authenticated');
create policy "auth_all" on atividades for all using (auth.role() = 'authenticated');
create policy "auth_all" on registros for all using (auth.role() = 'authenticated');
create policy "auth_all" on lista_presenca for all using (auth.role() = 'authenticated');
create policy "auth_all" on estoque for all using (auth.role() = 'authenticated');
create policy "auth_all" on movimentacoes_estoque for all using (auth.role() = 'authenticated');
create policy "auth_all" on compras for all using (auth.role() = 'authenticated');
create policy "auth_all" on perfis for all using (auth.role() = 'authenticated');
create policy "admin_only" on usuarios_aprovados for all using (auth.role() = 'authenticated');

-- Storage bucket para fotos e arquivos
insert into storage.buckets (id, name, public) values ('atividades', 'atividades', true) on conflict do nothing;
create policy "upload_auth" on storage.objects for insert with check (auth.role() = 'authenticated');
create policy "read_public" on storage.objects for select using (bucket_id = 'atividades');
create policy "delete_auth" on storage.objects for delete using (auth.role() = 'authenticated');

-- Trigger para criar perfil ao criar usuário
create or replace function public.handle_new_user()
returns trigger as \$\$
begin
  insert into public.perfis (id, email, nome, perfil)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(
      (select perfil from public.usuarios_aprovados where email = new.email limit 1),
      'leitura'
    )
  );
  return new;
end;
\$\$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
`

// ============================================================
// SQL ADICIONAL — Execute no Supabase SQL Editor
// (além do SCHEMA_SQL já existente)
// ============================================================
export const SCHEMA_SQL_V2 = `
-- TABELA DIRETORES
create table if not exists diretores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  area text not null,
  descricao text,
  whatsapp text,
  email text,
  foto_url text,
  ordem int default 0,
  ativo boolean default true,
  criado_em timestamptz default now()
);
alter table diretores enable row level security;
create policy "auth_all" on diretores for all using (auth.role() = 'authenticated');

-- TABELA TAREFAS_ATIVIDADE (responsáveis + tarefas por atividade)
create table if not exists tarefas_atividade (
  id uuid primary key default gen_random_uuid(),
  atividade_id uuid references atividades(id) on delete cascade,
  pessoa_id uuid,
  pessoa_nome text not null,
  pessoa_tipo text not null, -- 'coordenador' | 'diretor'
  tarefa text not null,
  criado_em timestamptz default now()
);
alter table tarefas_atividade enable row level security;
create policy "auth_all" on tarefas_atividade for all using (auth.role() = 'authenticated');

-- COLUNAS DE PRESENÇA REAL (adicionar à tabela atividades existente)
alter table atividades add column if not exists real_criancas int;
alter table atividades add column if not exists real_adultos int;

-- TABELA OPÇÕES CONFIGURÁVEIS
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

-- Dados iniciais das opções
insert into opcoes_sistema (categoria, valor, ordem) values
  ('temas_atividade','Arte Sacra',0),
  ('temas_atividade','Retiros Espirituais',1),
  ('temas_atividade','Catequese',2),
  ('temas_atividade','Terço & Oração',3),
  ('temas_atividade','Formação Familiar',4),
  ('temas_atividade','Missa das Crianças',5),
  ('temas_atividade','Adoração Eucarística',6),
  ('temas_atividade','Formação de Catequistas',7),
  ('temas_atividade','Outro',8),
  ('locais_atividade','Salão Principal',0),
  ('locais_atividade','Salão de Reuniões',1),
  ('locais_atividade','Pátio do Instituto',2),
  ('locais_atividade','Casa de Retiro',3),
  ('locais_atividade','Igreja Matriz',4),
  ('locais_atividade','Auditório',5),
  ('categorias_estoque','Material de Arte',0),
  ('categorias_estoque','Papelaria',1),
  ('categorias_estoque','Limpeza',2),
  ('categorias_estoque','Alimentos',3),
  ('categorias_estoque','Liturgia',4),
  ('categorias_estoque','Informática',5),
  ('categorias_estoque','Outros',6),
  ('categorias_compra','Material de Arte',0),
  ('categorias_compra','Papelaria',1),
  ('categorias_compra','Limpeza',2),
  ('categorias_compra','Alimentos',3),
  ('categorias_compra','Liturgia',4),
  ('categorias_compra','Informática',5),
  ('categorias_compra','Outros',6),
  ('areas_coordenador','Coordenação Geral',0),
  ('areas_coordenador','Atividades & Eventos',1),
  ('areas_coordenador','Catequese Infantil',2),
  ('areas_coordenador','Compras & Materiais',3),
  ('areas_coordenador','Orientação Espiritual',4),
  ('areas_coordenador','Finanças & Contas',5),
  ('areas_coordenador','Comunicação',6),
  ('areas_diretor','Direção Geral',0),
  ('areas_diretor','Direção Pedagógica',1),
  ('areas_diretor','Direção Administrativa',2),
  ('areas_diretor','Direção Financeira',3),
  ('areas_diretor','Direção Espiritual',4),
  ('unidades_estoque','un',0),
  ('unidades_estoque','cx',1),
  ('unidades_estoque','pacote',2),
  ('unidades_estoque','resma',3),
  ('unidades_estoque','kg',4),
  ('unidades_estoque','L',5)
on conflict (categoria, valor) do nothing;
`
