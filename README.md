# ✦ Instituto Nossa Senhora Menina — Portal Administrativo

Sistema administrativo completo com tecnologias **100% gratuitas**.

---

## 🛠️ Stack Tecnológica (Custo: R$ 0,00/mês)

| Serviço | Função | Plano Gratuito |
|---------|--------|----------------|
| **Supabase** | Banco de dados + Auth + Storage | 500MB DB, 1GB Storage, 50k usuários |
| **Cloudflare Pages** | Hospedagem + CDN + SSL | Ilimitado |
| **GitHub** | Repositório do código | Ilimitado |
| **Google OAuth** | Login com Google | Gratuito |
| **Google Calendar API** | Integração de agenda | Gratuito |

---

## 🚀 Configuração Passo a Passo

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Escolha um nome (ex: `insm-portal`), senha e região (sa-east-1 = São Paulo)
3. Aguarde o projeto ser criado (~2 min)
4. Vá em **Settings → API** e copie:
   - **Project URL** → será seu `VITE_SUPABASE_URL`
   - **anon public key** → será seu `VITE_SUPABASE_ANON_KEY`

### 2. Criar as Tabelas no Banco

1. No Supabase, vá em **SQL Editor → New Query**
2. Copie e execute **todo o conteúdo** da variável `SCHEMA_SQL` do arquivo `src/lib/supabase.js`
3. Clique em **Run** — todas as tabelas serão criadas automaticamente

### 3. Configurar Autenticação Google (OAuth)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto novo
3. Vá em **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Tipo: **Web Application**
5. Em "Authorized redirect URIs" adicione:
   ```
   https://SEU_PROJETO.supabase.co/auth/v1/callback
   ```
6. Copie o **Client ID** e **Client Secret**
7. No Supabase: **Authentication → Providers → Google**
8. Cole o Client ID e Client Secret e ative

### 4. Configurar Storage (para fotos)

1. No Supabase: **Storage → New Bucket**
2. Nome: `atividades`
3. Marque **Public bucket** ✓
4. O SQL do passo 2 já cria as políticas automaticamente

### 5. Criar o Arquivo de Variáveis de Ambiente

```bash
# Na raiz do projeto, crie o arquivo .env.local
cp .env.example .env.local
```

Edite o `.env.local`:
```env
VITE_SUPABASE_URL=https://abcdefghijklm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6. Instalar e Rodar Localmente

```bash
npm install
npm run dev
```

Acesse: `http://localhost:5173`

### 7. Criar o Primeiro Usuário Administrador

Como o sistema exige pré-aprovação, siga:

1. No Supabase: **Table Editor → usuarios_aprovados → Insert Row**
2. Preencha:
   - `email`: seu-email@gmail.com
   - `nome`: Seu Nome
   - `perfil`: admin
   - `ativo`: true
3. Agora acesse o site e crie sua conta com esse e-mail

---

## ☁️ Deploy no Cloudflare Pages

### 1. Subir para GitHub

```bash
git init
git add .
git commit -m "feat: Instituto NSM Portal v1"
git remote add origin https://github.com/SEU_USUARIO/insm-portal.git
git push -u origin main
```

### 2. Conectar ao Cloudflare Pages

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Pages → Create Application**
2. Conecte ao GitHub e selecione o repositório
3. Configurações de Build:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` = sua chave anon
5. Clique em **Save and Deploy**

### 3. Adicionar Domínio Personalizado (opcional)

1. No Cloudflare Pages → seu projeto → **Custom Domains**
2. Adicione seu domínio (ex: `admin.institutonsm.org.br`)
3. Configure o DNS conforme instruções

---

## 📦 Funcionalidades do Sistema

### 🔐 Autenticação
- Login via Google (OAuth 2.0) — um clique
- Login via e-mail + senha
- Cadastro de conta (apenas e-mails pré-aprovados)
- Recuperação de senha por e-mail
- 3 perfis: Administrador, Coordenador, Leitura

### 📌 Mural de Avisos
- Publicar avisos com categorias (Aviso, Urgente, Informativo, Conquista)
- Fixar avisos importantes no topo
- Filtrar por categoria
- Autor e data de publicação

### 👥 Coordenadores
- Cadastro com foto, área e descrição do papel
- Botão direto para WhatsApp
- Link para e-mail
- Busca por nome ou área
- Ordem de exibição configurável

### 🗓️ Planejamento de Atividades
- Cadastro completo com data, local, tema, participantes
- Horário de início e fim
- Lista de insumos necessários
- Status: Planejada → Realizada → Cancelada
- Integração com Google Calendar (clique para adicionar)
- Filtros por status e busca

### 🖨️ Lista de Presença
- Gerada automaticamente para cada atividade
- Separada por crianças e adultos
- Pronta para impressão (PDF via janela do navegador)
- Inclui espaço para assinatura

### 📸 Registros & Histórico
- Upload de múltiplas fotos por atividade
- Upload de documentos (PDF, Word)
- Galeria de fotos com visualização em tela cheia
- Exportação de histórico completo em PDF
- Organizado por atividade realizada

### 📈 Métricas
- Total de crianças e adultos atendidos
- Gráficos de participação por mês
- Gráficos por tema abordado
- Número de atividades por categoria
- Histórico tabelado de todas as atividades

### 📦 Controle de Estoque
- Cadastro com quantidade atual e mínima
- Alertas automáticos: OK / Baixo / Crítico
- Movimentações de entrada e saída com motivo
- Relatório PDF completo do estoque
- Filtro por status e busca

### 🛒 Materiais Comprados
- Registro de compras vinculadas a atividades
- Cálculo automático do valor total
- Gráficos de gastos por categoria
- Gráficos de gastos por atividade
- Relatório PDF categorizado com total geral
- Filtros por atividade, categoria e busca

### 🔐 Gestão de Usuários (apenas admin)
- Lista de e-mails pré-aprovados com perfis
- Suspender / Reativar acesso
- Alterar perfil de usuários cadastrados
- Visualização de todos os usuários ativos

---

## 🗄️ Estrutura do Projeto

```
insm/
├── src/
│   ├── components/
│   │   ├── Layout.jsx       # Sidebar + navegação
│   │   └── Modal.jsx        # Componente modal reutilizável
│   ├── hooks/
│   │   └── useToast.jsx     # Sistema de notificações
│   ├── lib/
│   │   ├── supabase.js      # Cliente Supabase + Schema SQL
│   │   └── pdf.js           # Geração de PDFs + Google Calendar
│   ├── pages/
│   │   ├── Login.jsx        # Tela de login
│   │   ├── Dashboard.jsx    # Visão geral
│   │   ├── Mural.jsx        # Mural de avisos
│   │   ├── Coordenadores.jsx
│   │   ├── Atividades.jsx   # Planejamento
│   │   ├── Registros.jsx    # Fotos e documentos
│   │   ├── Metricas.jsx     # Gráficos e métricas
│   │   ├── Estoque.jsx      # Controle de estoque
│   │   ├── Materiais.jsx    # Compras e gastos
│   │   └── Usuarios.jsx     # Gestão de acesso
│   ├── styles/
│   │   └── globals.css      # Design system completo
│   ├── App.jsx              # Router + Auth Context
│   └── main.jsx             # Entry point
├── public/
│   └── _redirects           # Cloudflare SPA routing
├── index.html
├── vite.config.js
├── package.json
└── .env.example
```

---

## 🆘 Suporte

Dúvidas sobre configuração? Consulte:
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Cloudflare Pages](https://developers.cloudflare.com/pages)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
