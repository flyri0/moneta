<p align="center">
	<img src="static/icon.svg" width="96" height="96" alt="" />
</p>

<h1 align="center">Moneta</h1>

<p align="center">Orçamento por envelopes, de base zero, que nunca sai do seu dispositivo.</p>

<p align="center">
	<a href="README.md">English</a> · <strong>Português (BR)</strong>
	<br /><br />
	<a href="https://github.com/flyri0/moneta/actions/workflows/ci.yml"><img src="https://github.com/flyri0/moneta/actions/workflows/ci.yml/badge.svg" alt="Status do CI" /></a>
</p>

---

## O que é o Moneta

O Moneta é um app de orçamento no espírito do YNAB e do Actual Budget. Você dá uma função
a cada centavo que entra: o dinheiro sai de **Pronto para atribuir** e vai para envelopes
de categoria, e os gastos consomem esses envelopes. Quando um envelope acaba, você decide
de onde tirar o dinheiro — em vez de descobrir isso no fim do mês.

Ele é **local**. Não há servidor, conta nem rastreamento. Seu orçamento é um banco de dados
SQLite que vive dentro do seu navegador (SQLite WASM no Origin Private File System) e fica
por lá. Instale o Moneta como PWA e ele funciona offline, no celular ou no computador.

## Sobre o nome

[Moneta](https://pt.wikipedia.org/wiki/Moneta) era uma deusa romana, um epíteto de Juno como
protetora dos fundos da cidade. O nome vem do verbo latino _monere_, "lembrar, avisar,
aconselhar", e os romanos a honravam como a conselheira que garantiria que nunca faltasse
dinheiro enquanto fossem justos. O dinheiro era cunhado no templo dela, e foi assim que o
nome dela virou a palavra para a própria moeda: _moeda_ em português, _money_ e _mint_ em
inglês e _moneda_ em espanhol vêm todas dela.

Um app de orçamento que te lembra para onde o seu dinheiro deve ir pareceu um xará à altura.

## Por que você pode gostar

- **Seu dinheiro não é da conta de ninguém.** Nada é enviado, porque não há para onde
  enviar.
- **Não tem cadastro.** É só abrir e começar.
- **O arquivo é seu.** Um orçamento é um arquivo `.sqlite`, e um backup reúne todos em um
  arquivo `.moneta` (um ZIP comum). Faça backup quando quiser, restaure em outra máquina,
  ou exporte para CSV e JSON.
- **Funciona no avião.** O app inteiro, banco de dados incluído, roda no navegador.

## O que ele faz

- Orçamento de base zero por envelopes, com Pronto para atribuir, grupos de categorias e
  rolagem do gasto a mais por categoria
- Atribuição rápida: igual ao mês passado, média gasta, cobrir gasto a mais, zerar
- Contas dentro do orçamento e fora dele (de acompanhamento)
- Cartões de crédito no estilo Actual Budget: contas normais dentro do orçamento com saldo
  negativo e transferências de pagamento neutras para o orçamento
- Categorias de receitas personalizáveis em um grupo de sistema dedicado que alimentam o Pronto
  para atribuir
- Transações divididas e transferências entre contas
- Transações agendadas e recorrentes, lançadas automaticamente ou com um toque, com a previsão
  dos próximos 30 dias em cada conta
- Gestão de favorecidos: renomear um favorecido em todas as transações passadas, mesclar
  duplicatas, definir uma categoria padrão e remover favorecidos sem uso
- Relatórios: gastos por categoria e por favorecido, patrimônio líquido, fluxo de caixa, tendência de gastos, ativos e dívidas por conta e idade do dinheiro, num painel cujos cards você pode reordenar e ocultar
- Vários orçamentos lado a lado
- Backup e restauração de todos os orçamentos em um arquivo `.moneta`, criptografado com
  senha e chave de recuperação se você quiser, além de exportações CSV e JSON, com lembrete
  quando o último backup tem mais de duas semanas
- Backups automáticos e criptografados no seu próprio Google Drive enquanto o Moneta está
  aberto, e restauração de lá em outro aparelho
- PWA instalável, que funciona offline, com uma página de boas-vindas que oferece a instalação
- Inglês e português do Brasil

## Futuro e roadmap

O Moneta v1 estabelece uma base sólida, offline e confiável para orçamento de base zero por envelopes. As direções planejadas para as próximas versões incluem:

- **Segurança e soberania de dados**:
  - **Criptografia do banco de dados em repouso**: Criptografia local do SQLite no OPFS usando senha mestra ou biometria (WebAuthn/Passkeys).
  - **Mais destinos de backup em nuvem**: WebDAV/Nextcloud, Dropbox e OneDrive ao lado do Google Drive, e sincronização com pasta local via File System Access API.
- **Importação e conciliação**:
  - **Importação de extratos bancários**: Suporte a arquivos OFX, QFX, QIF e CSV com mapeamento inteligente de colunas e detecção de duplicatas.
  - **Conciliação de contas**: Fluxo assistido de conciliação com o extrato do banco e travamento de transações já conferidas.
- **Metas e planejamento**:
  - **Metas por categoria**: Metas de saldo, saldo alvo por data, metas de gastos mensais, barras visuais de progresso e atribuição rápida com um clique ("Metas não cobertas").
- **Produtividade**:
  - **Navegação rápida e paleta de comandos**: Paleta de comandos rápida (`Ctrl/Cmd + K`) e atalhos de teclado para entrada ágil de transações.

## Como começar

Você precisa do [Node.js](https://nodejs.org) 24 ou mais novo e do [pnpm](https://pnpm.io)
12 ou mais novo.

```sh
pnpm install
pnpm dev            # sobe o servidor de desenvolvimento em http://localhost:5173
pnpm dev --open     # …e abre no navegador
```

Para gerar a versão de produção:

```sh
pnpm build          # build estático em ./build
pnpm preview        # serve esse build em http://localhost:4173
```

`build/` é um site estático comum. Publique em qualquer host que devolva `index.html` para
caminhos desconhecidos — sem código de servidor e sem precisar de cabeçalhos COOP/COEP.
Sirva a partir da raiz do domínio: o service worker que faz o app funcionar offline é
registrado em `/`. Dê ao Moneta uma origem só dele: qualquer outro app na mesma origem
consegue ler o armazenamento dele (OPFS, IndexedDB, localStorage), orçamentos incluídos.

A Content-Security-Policy vai dentro do `index.html` como uma tag `<meta>`, então a página
fica restrita em qualquer host. Mas uma tag meta não alcança tudo: os workers seguem os
cabeçalhos dos próprios scripts, e só um cabeçalho consegue proibir que o app seja embutido em
frames. Se o seu host permitir configurar cabeçalhos, envie uma Content-Security-Policy para os
workers (`/_app/immutable/workers/*` e `/sw.js`), `Content-Security-Policy: frame-ancestors
'none'` para o resto, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. Nenhum deles é
obrigatório. O `netlify.toml` tem todos eles, junto com a regra que devolve o `index.html`; a
política da própria página não pode ser repetida lá, porque os hashes dos scripts mudam a cada
build.

### Backups no Google Drive (opcional)

Os backups automáticos no Google Drive precisam de uma pequena função serverless,
`netlify/functions/oauth-token.mts`. O Google só entrega a um app de navegador tokens de uma
hora, a menos que o pedido leve o client secret do OAuth, e esse segredo não pode ir dentro do
app. A função o acrescenta aos dois pedidos de token que o Moneta faz (o login e a renovação do
token de uma hora) e não guarda nada: o token de longa duração fica no aparelho, e os backups
vão do navegador direto para o Drive. Sem `VITE_GOOGLE_CLIENT_ID` no build a opção não aparece,
então qualquer host estático continua funcionando.

1. No console do Google Cloud, crie um projeto, ative a **Google Drive API** e configure a
   tela de consentimento OAuth com o escopo `https://www.googleapis.com/auth/drive.file`.
   Publique-a (**Em produção**): enquanto está em Teste, os logins expiram em sete dias.
   `drive.file` é um escopo não sensível, então o Google não precisa revisar o app.
2. Crie um client OAuth do tipo **Aplicativo da Web**, com o seu site como origem JavaScript
   autorizada e `https://<seu site>/oauth/callback` como URI de redirecionamento.
3. Nas variáveis de ambiente do site no Netlify, defina `VITE_GOOGLE_CLIENT_ID` (o client id:
   público, lido pelo build e pela função) e `GOOGLE_CLIENT_SECRET` (lido só pela função), e
   publique de novo.

Para testar localmente, coloque as duas no `.env` (veja o `.env.example`), rode
`npx netlify dev` e acrescente o endereço dele (`http://localhost:8888`) às origens e URIs de
redirecionamento do client.

## Onde ficam seus dados

Cada orçamento é um único arquivo SQLite no armazenamento privado do navegador (OPFS).
Nada sai do aparelho, a menos que você ative os backups automáticos, e aí só criptografado.

Em **Ajustes → Backup** você salva todos os orçamentos nos downloads em um arquivo
`.moneta` e restaura os que escolher dele, e o Moneta avisa quando o último backup tem mais
de duas semanas. Um `.moneta` é um ZIP: o `moneta.json` o descreve, e `budgets/` guarda o
arquivo SQLite de cada orçamento. Restaurar um orçamento que já está no aparelho o substitui
e guarda o que ele tinha como cópia salva. Backups `.sqlite` antigos continuam restauráveis.

Ative **Criptografar backups** para proteger os próprios arquivos de backup. Você escolhe uma
senha e recebe uma chave de recuperação para guardar longe dos backups. O Moneta guarda a
chave de criptografia no aparelho, então fazer backup não pede nada, e restaurar pede a senha
ou a chave de recuperação. Um `.moneta` criptografado traz só as configurações da
criptografia no `moneta.json` e o backup inteiro, criptografado com AES-256-GCM, no
`payload.bin`. A chave vem da senha por PBKDF2-SHA256, ou da chave de recuperação por HKDF.
Sem as duas, ninguém abre esses backups, nem o Moneta.

O **Backup automático** conecta seu Google Drive uma vez e depois salva sozinho, numa pasta
Moneta de lá, um backup criptografado de todos os orçamentos: dois minutos depois que as
alterações param, quando você sai do app com uma alteração pendente, e ao abrir quando o último
tem um dia. Ele só roda com o Moneta aberto. Cada aparelho guarda um arquivo por dia, o mais
novo e os cinco dias anteriores, e apaga os mais antigos. Backups na nuvem são sempre
criptografados, então ele pede para ativar a criptografia antes, e restaurar do Drive em outro
aparelho pede a senha ou a chave de recuperação. O Moneta só enxerga os arquivos que ele mesmo
criou no seu Drive.

Antes que uma atualização
do app mude o esquema de um orçamento, o Moneta guarda uma cópia do arquivo antigo no mesmo
armazenamento (as três últimas), para que atualizar nunca seja um caminho sem volta.

Como o orçamento vive no armazenamento do navegador para este site, limpar os dados do site
apaga o orçamento. Guarde um backup em um lugar que seja seu.

## Desenvolvimento

| Comando          | O que faz                                             |
| ---------------- | ----------------------------------------------------- |
| `pnpm dev`       | Servidor de desenvolvimento em http://localhost:5173  |
| `pnpm build`     | Build estático de produção em `./build`               |
| `pnpm preview`   | Serve `./build` como faria um host estático           |
| `pnpm test`      | Todos os testes unitários uma vez (Vitest, Node)      |
| `pnpm test:unit` | Os mesmos testes em modo watch                        |
| `pnpm test:e2e`  | Faz o build e roda o Playwright no Chromium           |
| `pnpm lint`      | Prettier + ESLint                                     |
| `pnpm check`     | Checagem de tipos com svelte-check                    |
| `pnpm format`    | Corrige a formatação com o Prettier                   |
| `pnpm i18n`      | Compila as mensagens do Paraglide                     |
| `pnpm bench`     | Mede o recálculo do orçamento em um orçamento grande  |
| `pnpm icons`     | Regera os ícones do PWA a partir de `static/icon.svg` |

Os testes unitários e de integração rodam no Node com o Vitest; os testes de banco usam um
SQLite real em memória — o mesmo build WASM que o app usa. Os testes de ponta a ponta, em
`e2e/`, rodam o build de produção no Chromium:

```sh
pnpm exec playwright install chromium   # só na primeira vez
pnpm test:e2e
```

Em uma máquina Linux ou WSL recém-instalada, o Chromium pode não abrir por falta de
bibliotecas do sistema (por exemplo `libnspr4.so`). Instale-as uma vez, em um terminal
normal:

```sh
sudo pnpm exec playwright install-deps chromium
```

### Estrutura do projeto

```
src/core/domain/       TypeScript puro: dinheiro, meses, motor do orçamento, atribuição rápida
src/core/db/           lado do SQLite (roda em um Web Worker): esquema, migrações, repositórios, RPC
src/core/client/       lado da thread principal: cliente RPC, live queries, tab lock, registro e sessão
src/core/i18n/         catálogos de mensagens (en, pt-BR), mensagens de erro, rótulos e formatos
src/features/          módulos de funcionalidades (lógica de tela + componentes Svelte juntos):
  budget/              grade do orçamento, painéis de categoria/grupo, ordem, progresso, visualização
  accounts/            lista de contas, extrato, diálogos de criação de contas
  transactions/        diálogo de transação, validação de formulário
  schedules/           tela de agendamentos, formulário, resumo da repetição
  reports/             cards e páginas dos relatórios, layout do painel, intervalos de datas
  settings/            backup e restauração, armazenamento, tema, arquivos de orçamento
  onboarding/          passos iniciais, categorias de início
  welcome/             tela inicial, diálogo de instalação PWA
  backup/              backups, exportações CSV e JSON, lembrete de backup, backups na nuvem (cloud/)
  demo/                conjunto de dados de demonstração, sementes
src/components/        componentes Svelte compartilhados (ui/ tem os primitivos do shadcn-svelte, app/ tem a casca da aplicação)
src/routes/            páginas do SvelteKit
e2e/                   testes do Playwright
netlify/               a função opcional de tokens para os backups no Google Drive
```

### Traduções

Os textos da interface ficam em `src/core/i18n/messages/en.json` e `pt-BR.json`, e o
[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) os compila em
`src/core/i18n/paraglide/` (gerado, não versionado). `pnpm dev`, `pnpm build` e `pnpm check`
compilam por você; `pnpm i18n` faz isso sozinho. A primeira compilação baixa os plugins de
formato de mensagem do Paraglide pelo jsDelivr, então ela precisa de rede uma vez.

## Como contribuir

Relatos de bugs, traduções e pull requests são bem-vindos. Comece pelo
[CONTRIBUTING.md](CONTRIBUTING.md) (em inglês): ele cobre a configuração, as poucas regras
que mantêm as contas honestas e o que o CI espera antes de um PR entrar.

## Licença

[MIT](LICENSE).
