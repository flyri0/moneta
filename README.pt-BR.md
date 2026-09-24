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
- Gestão de favorecidos: renomear um favorecido em todas as transações passadas, mesclar
  duplicatas, definir uma categoria padrão e remover favorecidos sem uso
- Relatórios: gastos por categoria e patrimônio líquido ao longo do tempo
- Vários orçamentos lado a lado
- Backup e restauração de todos os orçamentos em um arquivo `.moneta`, criptografado com
  senha e chave de recuperação se você quiser, além de exportações CSV e JSON, com lembrete
  quando o último backup tem mais de duas semanas
- PWA instalável, que funciona offline, com uma página de boas-vindas que oferece a instalação
- Inglês e português do Brasil

## Futuro e roadmap

O Moneta v1 estabelece uma base sólida, offline e confiável para orçamento de base zero por envelopes. As direções planejadas para as próximas versões incluem:

- **Segurança e soberania de dados**:
  - **Criptografia do banco de dados em repouso**: Criptografia local do SQLite no OPFS usando senha mestra ou biometria (WebAuthn/Passkeys).
  - **Destinos de backup em nuvem**: Exportação de backups criptografados no próprio dispositivo diretamente para armazenamento do usuário (WebDAV/Nextcloud, Google Drive, Dropbox) e sincronização com pasta local via File System Access API.
- **Gestão de transações**:
  - **Transações recorrentes e agendadas**: Agendamento de despesas fixas e receitas com previsão visual de lançamentos futuros no extrato.
- **Importação e conciliação**:
  - **Importação de extratos bancários**: Suporte a arquivos OFX, QFX, QIF e CSV com mapeamento inteligente de colunas e detecção de duplicatas.
  - **Conciliação de contas**: Fluxo assistido de conciliação com o extrato do banco e travamento de transações já conferidas.
- **Metas e planejamento**:
  - **Metas por categoria**: Metas de saldo, saldo alvo por data, metas de gastos mensais, barras visuais de progresso e atribuição rápida com um clique ("Metas não cobertas").
- **Relatórios e produtividade**:
  - **Novos relatórios**: Demonstrativo mensal de receitas vs. despesas, gastos por favorecido e evolução do fluxo de caixa.
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
registrado em `/`.

A Content-Security-Policy vai dentro do `index.html` como uma tag `<meta>`, então o app fica
protegido em qualquer host. Se o seu permitir configurar cabeçalhos, envie também
`Content-Security-Policy: frame-ancestors 'none'` (uma tag meta não consegue proibir que o app
seja embutido em frames), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e
`Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. Nenhum deles é
obrigatório. O `netlify.toml` tem um exemplo, junto com a regra que devolve o `index.html`.

## Onde ficam seus dados

Cada orçamento é um único arquivo SQLite no armazenamento privado do navegador (OPFS).
Nada sai do dispositivo por conta própria.

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
  reports/             patrimônio líquido, gastos por categoria, intervalos de datas
  settings/            backup e restauração, armazenamento, tema, arquivos de orçamento
  onboarding/          passos iniciais, categorias de início
  welcome/             tela inicial, diálogo de instalação PWA
  backup/              backups, exportações CSV e JSON, lembrete de backup
  demo/                conjunto de dados de demonstração, sementes
src/components/        componentes Svelte compartilhados (ui/ tem os primitivos do shadcn-svelte, app/ tem a casca da aplicação)
src/routes/            páginas do SvelteKit
e2e/                   testes do Playwright
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
