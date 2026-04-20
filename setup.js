#!/usr/bin/env node
/**
 * ✦ Instituto Nossa Senhora Menina — Script de Setup Inicial
 * Cadastra o primeiro administrador e verifica as tabelas.
 * Uso: node setup.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
    console.error('   Copie .env.example para .env.local e preencha com suas chaves.\n')
    process.exit(1)
  }
}

const PRIMEIRO_ADMIN = {
  nome: 'Marco Bueno',
  email: 'bueno.marco@gmail.com',
  perfil: 'admin',
  ativo: true,
}

const cor = {
  verde:    t => `\x1b[32m${t}\x1b[0m`,
  azul:     t => `\x1b[34m${t}\x1b[0m`,
  amarelo:  t => `\x1b[33m${t}\x1b[0m`,
  vermelho: t => `\x1b[31m${t}\x1b[0m`,
  negrito:  t => `\x1b[1m${t}\x1b[0m`,
  cinza:    t => `\x1b[90m${t}\x1b[0m`,
}

async function main() {
  console.log('\n' + cor.azul('═'.repeat(60)))
  console.log(cor.negrito(cor.azul('  ✦  Instituto Nossa Senhora Menina')))
  console.log(cor.azul('     Setup Inicial do Sistema'))
  console.log(cor.azul('═'.repeat(60)) + '\n')

  const env = lerEnv()
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY

  if (!url || url.includes('placeholder') || !key || key.includes('placeholder')) {
    console.error(cor.vermelho('\n❌ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local\n'))
    process.exit(1)
  }

  console.log(cor.cinza('→ Conectando ao Supabase...'))
  const supabase = createClient(url, key)

  // Verificar tabela principal
  const { error: tabelaErr } = await supabase.from('usuarios_aprovados').select('id').limit(1)
  if (tabelaErr) {
    console.error(cor.vermelho('\n❌ Tabela usuarios_aprovados não encontrada!'))
    console.error(cor.amarelo('\n   Execute o SQL do arquivo src/lib/supabase.js no Supabase SQL Editor primeiro.\n'))
    process.exit(1)
  }
  console.log(cor.verde('  ✓ Tabelas principais encontradas'))

  // Verificar novas tabelas (v2)
  const tabelas = ['diretores', 'tarefas_atividade', 'opcoes_sistema']
  for (const t of tabelas) {
    const { error } = await supabase.from(t).select('id').limit(1)
    if (error) {
      console.log(cor.amarelo(`  ⚠  Tabela "${t}" não encontrada — execute também o SCHEMA_SQL_V2`))
    } else {
      console.log(cor.verde(`  ✓ Tabela "${t}" OK`))
    }
  }

  // Cadastrar primeiro admin
  console.log(cor.cinza(`\n→ Verificando administrador ${PRIMEIRO_ADMIN.email}...`))
  const { data: existente } = await supabase
    .from('usuarios_aprovados')
    .select('id, perfil, ativo')
    .eq('email', PRIMEIRO_ADMIN.email)
    .maybeSingle()

  if (existente) {
    if (existente.perfil !== 'admin' || !existente.ativo) {
      await supabase.from('usuarios_aprovados').update({ perfil: 'admin', ativo: true }).eq('email', PRIMEIRO_ADMIN.email)
      console.log(cor.amarelo(`  ⚠  Atualizado para perfil admin e ativo ✓`))
    } else {
      console.log(cor.verde(`  ✓ Administrador já cadastrado e ativo`))
    }
  } else {
    const { error } = await supabase.from('usuarios_aprovados').insert(PRIMEIRO_ADMIN)
    if (error) { console.error(cor.vermelho(`\n❌ Erro: ${error.message}\n`)); process.exit(1) }
    console.log(cor.verde(`  ✓ Administrador cadastrado com sucesso!`))
  }

  // Corrigir perfil se já existe na tabela perfis
  const { data: perfilExistente } = await supabase.from('perfis').select('id,perfil').eq('email', PRIMEIRO_ADMIN.email).maybeSingle()
  if (perfilExistente && perfilExistente.perfil !== 'admin') {
    await supabase.from('perfis').update({ perfil: 'admin' }).eq('email', PRIMEIRO_ADMIN.email)
    console.log(cor.verde(`  ✓ Perfil na tabela perfis corrigido para admin`))
  }

  console.log('\n' + cor.azul('─'.repeat(60)))
  console.log(cor.negrito(cor.verde('  ✅  Setup concluído!')))
  console.log(cor.azul('─'.repeat(60)))
  console.log()
  console.log(`  Admin configurado: ${cor.azul(PRIMEIRO_ADMIN.nome)} (${cor.azul(PRIMEIRO_ADMIN.email)})`)
  console.log()
  console.log(cor.negrito('  Próximos passos:'))
  console.log(`  ${cor.cinza('1.')} npm run dev`)
  console.log(`  ${cor.cinza('2.')} Acesse http://localhost:5173`)
  console.log(`  ${cor.cinza('3.')} Login com ${cor.azul(PRIMEIRO_ADMIN.email)} via Google ou senha`)
  console.log()
  console.log(cor.cinza('  ⚠  Se ainda não executou o SCHEMA_SQL_V2, faça isso no'))
  console.log(cor.cinza('     Supabase SQL Editor (src/lib/supabase.js → SCHEMA_SQL_V2)'))
  console.log()
}

main().catch(err => { console.error('\n❌ Erro: ' + err.message); process.exit(1) })
