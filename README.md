# BrincaGestor

Sistema de gestão para locação de brinquedos infantis (brinquedos, clientes,
reservas, financeiro, orçamentos, contratos, recibos e estatísticas).

Os dados são salvos em um banco de dados Supabase compartilhado — qualquer
pessoa que entrar com a senha de acesso vê os mesmos dados, em qualquer
aparelho.

## Configuração

### 1. Banco de dados (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o script `setup.sql` (na raiz deste projeto) para
   criar as tabelas.
3. Em **Configurações → Chaves de API**, copie:
   - a **URL do projeto** (Project URL)
   - a **chave publicável** (publishable / anon key)

### 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel-aqui
VITE_APP_PASSWORD=escolha-uma-senha
```

`VITE_APP_PASSWORD` é a senha que você e seu colega vão digitar para entrar
no app — escolha algo simples de digitar no celular.

### 3. Rodar localmente (opcional)

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Publicar online (Vercel)

1. Suba este projeto para um repositório no **GitHub**.
2. Em [vercel.com](https://vercel.com), clique em **"Add New Project"** e
   importe esse repositório.
3. Em **Environment Variables**, adicione as mesmas três variáveis do `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_PASSWORD`).
4. Clique em **Deploy**. Em 1-2 minutos você terá um link
   `https://seu-projeto.vercel.app`.

## Usar no celular

1. Abra o link no navegador do celular (Chrome no Android, Safari no
   iPhone).
2. Digite a senha de acesso.
3. Use o menu do navegador → **"Adicionar à tela inicial"** (ou
   **"Instalar app"**). Isso cria um ícone que abre o app em tela cheia,
   como um aplicativo normal.

## Notas

- Imagens de brinquedos e logo da empresa são salvas como texto (base64) no
  banco. Para uso pessoal com poucas imagens isso funciona bem; se o app
  ficar lento ao salvar fotos grandes, vale migrar para o **Supabase
  Storage** no futuro.
- A senha de acesso (`VITE_APP_PASSWORD`) é uma proteção simples para uso
  pessoal/familiar — não substitui um sistema de login com contas
  individuais.
