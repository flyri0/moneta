<p align="center">
	<img src="static/icon.svg" width="96" height="96" alt="" />
</p>

<h1 align="center">Moneta</h1>

<p align="center">Orçamento por envelopes, de base zero, que nunca sai do seu dispositivo.</p>

<p align="center">
	<a href="https://usemoneta.netlify.app"><strong>Ver uma demonstração</strong></a> ·
	<a href="README.md">English</a> · <strong>Português (BR)</strong>
	<br /><br />
	<a href="https://github.com/flyri0/moneta/actions/workflows/ci.yml"><img src="https://github.com/flyri0/moneta/actions/workflows/ci.yml/badge.svg" alt="Status do CI" /></a>
	<a href="https://app.netlify.com/projects/usemoneta/deploys"><img src="https://api.netlify.com/api/v1/badges/058ac25a-38ff-40b3-a04e-d586850df680/deploy-status" alt="Status do Netlify" /></a>
</p>

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/budget-dark.pt-BR.png" />
	<img src=".github/screenshots/budget-light.pt-BR.png" alt="A tela do orçamento: Pronto para atribuir no topo e, abaixo, os grupos de categorias com o que foi atribuído, gasto e ainda está disponível em cada envelope." />
</picture>

> [!WARNING]
> **O Moneta é um projeto pessoal experimental.** Ele foi escrito 100% por LLMs, como uma
> forma de eu aprender. Ele é utilizável, mas vem sem garantia nenhuma: não me responsabilizo
> por perda ou roubo de dados. Use por sua conta e risco e mantenha backups em um lugar que
> você controle.

## O que é

O Moneta é um app de orçamento no espírito do YNAB e do Actual Budget. Você dá uma função a
cada centavo que entra: o dinheiro cai em **Pronto para atribuir**, você o distribui entre
envelopes de categoria, e os gastos consomem esses envelopes. Quando um envelope acaba, você
decide de onde tirar o dinheiro, em vez de descobrir isso no fim do mês.

Ele roda inteiro no seu navegador. Não há servidor, conta nem rastreamento: seu orçamento é
um banco de dados SQLite guardado no seu dispositivo, e fica por lá. Instale-o como app e ele
funciona offline, no celular ou no computador.

**[Ver uma demonstração](https://usemoneta.netlify.app)**: ela abre um ano de dados de
exemplo, e nada do que você fizer lá é salvo.

## Recursos

- **Orçamento de base zero por envelopes.** A receita cai em Pronto para atribuir e você a
  distribui entre categorias organizadas em grupos. O gasto a mais passa para o mês seguinte
  em cada categoria, e a atribuição rápida preenche o mês para você: igual ao mês passado, a
  média gasta em 3, 6 ou 12 meses, cobrir o gasto a mais, ou zerar.
- **Contas e transações.** Contas do orçamento e de acompanhamento, cartões de crédito cujos
  pagamentos não mexem no orçamento, transações divididas, transferências entre contas e
  favorecidos que você pode renomear em todo lugar, mesclar e associar a uma categoria padrão.
- **Transações agendadas.** Únicas, diárias, semanais, mensais ou anuais, com uma regra para
  datas que caem no fim de semana. São lançadas sozinhas ou com um toque, e cada conta mostra
  o que vem nos próximos 30 dias.
- **Relatórios.** Gastos por categoria e por favorecido, patrimônio líquido, fluxo de caixa,
  tendência de gastos, ativos e dívidas por conta e idade do dinheiro, num painel cujos cards
  você pode reordenar e ocultar.
- **Seus dados, no seu dispositivo.** Vários orçamentos lado a lado, backups em um único
  arquivo `.moneta` (criptografado, se você quiser), exportações CSV e JSON e backups
  automáticos e criptografados no seu próprio Google Drive.
- **Feito para qualquer tela.** No celular, barra inferior e painéis que sobem da base; no
  computador, barra lateral e diálogos; temas claro e escuro e dez cores de destaque.

O app inteiro está em inglês e português do Brasil.

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/reports-dark.pt-BR.png" />
	<img src=".github/screenshots/reports-light.pt-BR.png" alt="O painel de relatórios: gastos por categoria, patrimônio líquido, fluxo de caixa e gastos por favorecido." />
</picture>

<p align="center">
	<img src=".github/screenshots/phone.pt-BR.png" alt="O Moneta no celular: o orçamento, uma nova transação e os relatórios." />
</p>

## Onde ficam seus dados

Cada orçamento é um arquivo SQLite no armazenamento privado do navegador para o site (o
Origin Private File System). Nada sai do seu dispositivo, a menos que você ative os backups
automáticos, e aí só criptografado.

Como o orçamento vive no armazenamento do navegador, **limpar os dados do site apaga o
orçamento.** Guarde um backup em um lugar que seja seu.

### Backups

Em **Ajustes → Backup** você salva todos os orçamentos em um arquivo `.moneta` nos seus
downloads e restaura dele os orçamentos que escolher. O Moneta avisa quando o último backup
tem mais de duas semanas.

- Um `.moneta` é um ZIP: o `moneta.json` o descreve, e `budgets/` guarda o arquivo SQLite de
  cada orçamento. Backups `.sqlite` antigos continuam restauráveis.
- Restaurar um orçamento que já está no dispositivo o substitui e guarda o que ele tinha como
  cópia salva.
- Antes que uma atualização mude o formato de um orçamento, o Moneta guarda uma cópia do
  arquivo antigo (as três últimas), para que atualizar nunca seja um caminho sem volta.

### Backups criptografados

Ative **Criptografar backups** para proteger os próprios arquivos. Você escolhe uma senha e
recebe uma chave de recuperação para guardar longe dos backups.

- Fazer backup nunca pede nada: o Moneta guarda a chave de criptografia no dispositivo.
  Restaurar pede a senha ou a chave de recuperação.
- Um `.moneta` criptografado traz só as configurações da criptografia no `moneta.json` e o
  backup inteiro, criptografado com AES-256-GCM, no `payload.bin`. A chave vem da senha por
  PBKDF2-SHA256, ou da chave de recuperação por HKDF.
- Sem a senha e sem a chave de recuperação, ninguém abre esses backups, nem o Moneta.

### Backup automático no Google Drive

Conecte seu Google Drive uma vez e o Moneta salva sozinho, numa pasta Moneta de lá, um backup
criptografado de todos os orçamentos.

- Ele faz o backup dois minutos depois que as alterações param, quando você sai do app com uma
  alteração pendente, e ao abrir quando o último backup tem um dia. Só roda com o Moneta
  aberto.
- Cada dispositivo guarda um arquivo por dia, o mais novo e os cinco dias anteriores, e apaga
  os mais antigos.
- Backups na nuvem são sempre criptografados, então ele pede para ativar a criptografia antes.
  Restaurar do Drive em outro dispositivo pede a senha ou a chave de recuperação.
- O Moneta só enxerga os arquivos que ele mesmo criou no seu Drive.

## Rode sua própria cópia

Você precisa do [Node.js](https://nodejs.org) 24 ou mais novo e do [pnpm](https://pnpm.io)
12 ou mais novo.

```sh
pnpm install
pnpm build          # build estático em ./build
pnpm preview        # serve esse build em http://localhost:4173
```

`build/` é um site estático comum: sem código de servidor e sem precisar de cabeçalhos
COOP/COEP. Para hospedar:

- Use um host que devolva `index.html` para caminhos desconhecidos.
- Sirva a partir da raiz do domínio: o service worker que faz o app funcionar offline é
  registrado em `/`.
- Dê ao Moneta uma origem só dele. Qualquer outro app na mesma origem consegue ler o
  armazenamento dele (OPFS, IndexedDB, localStorage), orçamentos incluídos.

### Cabeçalhos de segurança (opcional)

A Content-Security-Policy vai dentro do `index.html` como uma tag `<meta>`, então a página
fica restrita em qualquer host. Mas uma tag meta não alcança tudo: os workers seguem os
cabeçalhos dos próprios scripts, e só um cabeçalho consegue proibir que o app seja embutido em
frames. Se o seu host permitir configurar cabeçalhos, envie:

- uma Content-Security-Policy para os workers (`/_app/immutable/workers/*` e `/sw.js`);
- `Content-Security-Policy: frame-ancestors 'none'` para todo o resto;
- `X-Content-Type-Options: nosniff` e `Referrer-Policy: no-referrer`;
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`.

O `netlify.toml` tem todos eles, junto com a regra que devolve o `index.html`. A política da
própria página não pode ser repetida lá, porque os hashes dos scripts mudam a cada build.

### Backups no Google Drive (opcional)

Os backups automáticos no Google Drive precisam de uma pequena função serverless,
`netlify/functions/oauth-token.mts`. O Google só entrega a um app de navegador tokens de uma
hora, a menos que o pedido leve o client secret do OAuth, e esse segredo não pode ir dentro do
app. A função o acrescenta aos dois pedidos de token que o Moneta faz (o login e a renovação do
token de uma hora) e não guarda nada: o token de longa duração fica no dispositivo, e os
backups vão do navegador direto para o Drive. Sem `VITE_GOOGLE_CLIENT_ID` no build a opção não
aparece, então qualquer host estático continua funcionando.

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

## Desenvolvimento

```sh
pnpm install
pnpm dev            # servidor de desenvolvimento em http://localhost:5173
pnpm dev --open     # …e abre no navegador
```

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
SQLite real em memória, o mesmo build WASM que o app usa. Os testes de ponta a ponta, em
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

## Sobre o nome

[Moneta](https://pt.wikipedia.org/wiki/Moneta) era uma deusa romana, um epíteto de Juno como
protetora dos fundos da cidade. O nome vem do verbo latino _monere_, "lembrar, avisar,
aconselhar", e os romanos a honravam como a conselheira que garantiria que nunca faltasse
dinheiro enquanto fossem justos. O dinheiro era cunhado no templo dela, e foi assim que o
nome dela virou a palavra para a própria moeda: _moeda_ em português, _money_ e _mint_ em
inglês e _moneda_ em espanhol vêm todas dela.

Um app de orçamento que te lembra para onde o seu dinheiro deve ir pareceu um xará à altura.

## Como contribuir

Relatos de bugs, traduções e pull requests são bem-vindos. Comece pelo
[CONTRIBUTING.md](CONTRIBUTING.md) (em inglês): ele cobre a configuração, as poucas regras
que mantêm as contas honestas e o que o CI espera antes de um PR entrar.

## Licença

[MIT](LICENSE).
