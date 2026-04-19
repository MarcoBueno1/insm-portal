#!/usr/bin/env node
/**
 * ✦ Instituto Nossa Senhora Menina — Script de Setup Inicial
 *
 * Executa UMA VEZ após criar o projeto no Supabase.
 * Cadastra o primeiro administrador na tabela usuarios_aprovados
 * para que ele possa criar a conta e acessar o sistema.
 *
 * Uso:
 *   node setup.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Lê as variáveis do .env.local ──────────────────────────────
function lerEnv() {
  try {
    const envPath = resolve(__dirname, '.env.local')
    const conteudo = readFileSync(envPath, 'utf-8')
    const vars = {}
    conteudo.split('\n').forEach(linha => {
      linha = linha.trim()
      if (!linha || linha.startsWith('#')) return
      const [chave, ...resto] = linha.split('=')
      vars[chave.trim()] = resto.join('=').trim()
    })
    return vars
  } catch {
    console.error('\n❌ Arquivo .env.local não encontrado!')
    console.error('   Copie .env.example para .env.local e preencha com suas chaves do Supabase.\n')
    process.exit(1)
  }
}

// ── Configuração do primeiro admin ─────────────────────────────
const PRIMEIRO_ADMIN = {
  nome:   'Marco Bueno',
  email:  'bueno.marco@gmail.com',
  perfil: 'admin',
  ativo:  true,
}

// ── Cores para o terminal ──────────────────────────────────────
const cor = {
  verde:    (t) => `\x1b[32m${t}\x1b[0m`,
  azul:     (t) => `\x1b[34m${t}\x1b[0m`,
  amarelo:  (t) => `\x1b[33m${t}\x1b[0m`,
  vermelho: (t) => `\x1b[31m${t}\x1b[0m`,
  negrito:  (t) => `\x1b[1m${t}\x1b[0m`,
  cinza:    (t) => `\x1b[90m${t}\x1b[0m`,
}

function linha(c = '─', n = 60) { return c.repeat(n) }

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('\n' + cor.azul(linha('═')))
  console.log(cor.negrito(cor.azul('  ✦  Instituto Nossa Senhora Menina')))
  console.log(cor.azul('     Setup Inicial do Sistema'))
  console.log(cor.azul(linha('═')) + '\n')

  // 1. Ler variáveis de ambiente
  console.log(cor.cinza('→ Lendo configurações do .env.local...'))
  const env = lerEnv()

  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY

  if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
    console.error(cor.vermelho('\n❌ As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY'))
    console.error(cor.vermelho('   não foram configuradas no .env.local!\n'))
    console.error('   Abra o .env.local e preencha com os dados do seu projeto Supabase.')
    console.error('   Acesse: Settings → API no painel do Supabase.\n')
    process.exit(1)
  }

  console.log(cor.verde('  ✓ Configurações carregadas'))
  console.log(cor.cinza(`    URL: ${url}`))

  // 2. Conectar ao Supabase
  console.log(cor.cinza('\n→ Conectando ao Supabase...'))
  const supabase = createClient(url, key)

  // 3. Verificar se as tabelas existem
  console.log(cor.cinza('→ Verificando se as tabelas foram criadas...'))
  const { error: tabelaErr } = await supabase.from('usuarios_aprovados').select('id').limit(1)

  if (tabelaErr) {
    console.error(cor.vermelho('\n❌ Tabela usuarios_aprovados não encontrada!'))
    console.error(cor.amarelo('\n   SOLUÇÃO: Execute o SQL do banco antes de rodar o setup:'))
    console.error('   1. Abra o Supabase → SQL Editor → New Query')
    console.error('   2. Abra o arquivo src/lib/supabase.js')
    console.error('   3. Copie o bloco de SQL (variável SCHEMA_SQL)')
    console.error('   4. Cole e execute no SQL Editor do Supabase\n')
    process.exit(1)
  }
  console.log(cor.verde('  ✓ Tabelas encontradas'))

  // 4. Verificar se o admin já existe
  console.log(cor.cinza(`\n→ Verificando se ${PRIMEIRO_ADMIN.email} já está cadastrado...`))
  const { data: existente } = await supabase
    .from('usuarios_aprovados')
    .select('id, nome, perfil, ativo')
    .eq('email', PRIMEIRO_ADMIN.email)
    .maybeSingle()

  if (existente) {
    // Já existe — garante que está como admin e ativo
    if (existente.perfil !== 'admin' || !existente.ativo) {
      await supabase
        .from('usuarios_aprovados')
        .update({ perfil: 'admin', ativo: true })
        .eq('email', PRIMEIRO_ADMIN.email)
      console.log(cor.amarelo(`  ⚠  Já existia com perfil "${existente.perfil}" → atualizado para admin ✓`))
    } else {
      console.log(cor.verde(`  ✓ Administrador já cadastrado e ativo`))
    }
  } else {
    // Não existe — insere
    console.log(cor.cinza(`→ Cadastrando primeiro administrador...`))
    const { error: insertErr } = await supabase
      .from('usuarios_aprovados')
      .insert(PRIMEIRO_ADMIN)

    if (insertErr) {
      console.error(cor.vermelho(`\n❌ Erro ao cadastrar administrador: ${insertErr.message}\n`))
      process.exit(1)
    }
    console.log(cor.verde(`  ✓ Administrador cadastrado com sucesso!`))
  }

  // 5. Verificar outros admins existentes (por segurança)
  const { data: todosAdmins } = await supabase
    .from('usuarios_aprovados')
    .select('nome, email')
    .eq('perfil', 'admin')
    .eq('ativo', true)

  // 6. Resumo final
  console.log('\n' + cor.azul(linha()))
  console.log(cor.negrito(cor.verde('  ✅  Setup concluído com sucesso!')))
  console.log(cor.azul(linha()))
  console.log()
  console.log(cor.negrito('  Administrador configurado:'))
  console.log(`    Nome:   ${cor.azul(PRIMEIRO_ADMIN.nome)}`)
  console.log(`    E-mail: ${cor.azul(PRIMEIRO_ADMIN.email)}`)
  console.log(`    Perfil: ${cor.verde('⭐ Administrador')}`)
  console.log()
  console.log(cor.negrito('  Próximos passos:'))
  console.log(`    ${cor.cinza('1.')} Inicie o sistema: ${cor.amarelo('npm run dev')}`)
  console.log(`    ${cor.cinza('2.')} Acesse:           ${cor.azul('http://localhost:5173')}`)
  console.log(`    ${cor.cinza('3.')} Faça login com:   ${cor.azul(PRIMEIRO_ADMIN.email)}`)
  console.log(`         via Google (recomendado) ou crie uma senha`)
  console.log()
  console.log(cor.cinza('  ──────────────────────────────────────────────────'))
  console.log(cor.cinza('  Para adicionar mais usuários, acesse o sistema e'))
  console.log(cor.cinza('  vá em: 🔐 Usuários & Controle de Acesso'))
  console.log()

  if (todosAdmins && todosAdmins.length > 1) {
    console.log(cor.amarelo(`  ⚠  Atenção: há ${todosAdmins.length} administradores no sistema:`))
    todosAdmins.forEach(a => console.log(cor.cinza(`     • ${a.nome} (${a.email})`)))
    console.log()
  }
}

main().catch(err => {
  console.error(cor.vermelho('\n❌ Erro inesperado: ' + err.message))
  process.exit(1)
})
