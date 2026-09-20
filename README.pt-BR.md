<p align="center">
	<img src="static/icon.svg" width="96" height="96" alt="" />
</p>

<h1 align="center">Moneta</h1>

<p align="center">Orçamento por envelopes, de base zero, que nunca sai do seu dispositivo.</p>

<p align="center">
	<a href="README.md">English</a> · <strong>Português (BR)</strong>
	<br />
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

## Por que você pode gostar

- **Seu dinheiro não é da conta de ninguém.** Nada é enviado, porque não há para onde
  enviar.
- **Não tem cadastro.** É só abrir e começar.
- **O arquivo é seu.** Um orçamento é um arquivo `.sqlite`. Faça backup quando quiser,
  restaure em outra máquina, ou exporte para CSV e JSON.
- **Funciona no avião.** O app inteiro, banco de dados incluído, roda no navegador.

## O que ele faz

- Orçamento de base zero por envelopes, com Pronto para atribuir, grupos de categorias e
  rolagem do gasto a mais por categoria
- Atribuição rápida: igual ao mês passado, média gasta, cobrir gasto a mais, zerar
- Contas dentro do orçamento e fora dele (de acompanhamento)
- Cartões de crédito com categorias de pagamento automáticas
- Transações divididas e transferências entre contas
- Relatórios: gastos por categoria e patrimônio líquido ao longo do tempo
- Vários orçamentos lado a lado
- Backup e restauração em `.sqlite`, além de exportações CSV e JSON, com lembrete quando o
  último backup tem mais de duas semanas
- PWA instalável, que funciona offline
- Inglês e português do Brasil

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

## Onde ficam seus dados

Cada orçamento é um único arquivo SQLite no armazenamento privado do navegador (OPFS).
Nada sai do dispositivo por conta própria.

Em **Configurações → Backup** você salva esse arquivo nos downloads e restaura um backup, e
o Moneta avisa quando o último backup tem mais de duas semanas. Antes que uma atualização
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
src/lib/domain/        TypeScript puro: dinheiro, meses, motor do orçamento, atribuição rápida
src/lib/db/            lado do SQLite (roda em um Web Worker): esquema, migrações, repositórios, RPC
src/lib/client/        lado da thread principal: cliente RPC, live queries, tab lock, registro e sessão
src/lib/budget/        lógica da tela de orçamento (modelo da grade, ordem das categorias)
src/lib/accounts/      lógica de contas e do extrato
src/lib/transactions/  lógica do formulário de transações
src/lib/reports/       lógica dos relatórios (intervalos de datas, participação nos gastos)
src/lib/backup/        backups, exportações CSV e JSON, lembrete de backup
src/lib/i18n/          catálogos de mensagens (en, pt-BR), mensagens de erro, rótulos e formatos
src/lib/components/    componentes Svelte (ui/ tem os primitivos do shadcn-svelte)
src/routes/            páginas do SvelteKit
e2e/                   testes do Playwright
```

### Traduções

Os textos da interface ficam em `src/lib/i18n/messages/en.json` e `pt-BR.json`, e o
[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) os compila em
`src/lib/paraglide/` (gerado, não versionado). `pnpm dev`, `pnpm build` e `pnpm check`
compilam por você; `pnpm i18n` faz isso sozinho. A primeira compilação baixa os plugins de
formato de mensagem do Paraglide pelo jsDelivr, então ela precisa de rede uma vez.

## Como contribuir

Relatos de bugs, traduções e pull requests são bem-vindos. Comece pelo
[CONTRIBUTING.md](CONTRIBUTING.md) (em inglês): ele cobre a configuração, as poucas regras
que mantêm as contas honestas e o que o CI espera antes de um PR entrar.

## Licença

[MIT](LICENSE).
