# Transações

Cada movimento de dinheiro é uma transação: uma compra, um salário, uma transferência entre
contas. **Transações** lista todas, de todas as contas; o extrato de cada conta mostra as dela.

## Lançar uma transação {#entering}

Use o botão **Transação** (**+ Transação**, flutuando acima da barra de baixo no celular). Preencha:

- **Conta**: onde o dinheiro se moveu.
- **Data**.
- **Favorecido**: a quem você pagou ou quem pagou você. Digite um nome novo para criar um. Um
  favorecido com categoria padrão já a preenche; senão o Moneta sugere a categoria usada da última
  vez.
- **Valor**, com **Saída** ou **Entrada**. Os valores aceitam contas simples, como `10+5`.
- **Categoria**: obrigatória nas contas do orçamento. A lista mostra quanto cada categoria tem
  disponível no mês da transação. Digite um nome que não existe para criar a categoria (e até o
  grupo dela) ao salvar.
- **Memorando** e **Compensada**, ambos opcionais.
- **Flag**, também opcional: uma cor para [marcá-la](#flags).

A renda vai numa categoria de receita, como Salário: é isso que a soma ao Pronto para atribuir.

Uma data a mais de dois anos no futuro costuma ser erro de digitação, então o Moneta pergunta
antes de salvar.

### Editar ou excluir uma {#editing}

Toque numa transação para ver tudo dela: valor, data, conta, favorecido, categoria (ou cada linha
de uma divisão), memorando e se já foi compensada. Dali:

- **Editar transação** abre o formulário: mude o que precisar e salve, ou cancele para voltar.
- **Abrir ‹conta›** vai para a conta dela. Já estando nessa conta, uma transferência abre a outra
  conta.
- **Excluir transação** pergunta antes; logo depois, ainda dá para [desfazer](#undo).

## Dividir {#splits}

Um recibo, várias categorias: escolha **Dividir** e adicione uma linha por categoria, cada uma com
valor e memorando. As linhas precisam somar o valor da transação; o Moneta mostra quanto falta
distribuir.

![Uma compra de R$ 80,00 dividida entre Mercado e Casa, sem nada faltando distribuir.](img/split-light.pt-BR.png)

## Transferências {#transfers}

Para mover dinheiro entre suas contas, escolha a outra conta como favorecido (em
**Transferências**). O Moneta registra os dois lados de uma vez.

- Entre duas contas do orçamento (da corrente para a poupança, ou pagando um cartão), a
  transferência não tem categoria e não muda o orçamento.
- De uma conta do orçamento para uma de acompanhamento (para um investimento, ou a parcela de um
  empréstimo), o dinheiro sai do orçamento, então a transferência precisa de uma categoria, como um
  gasto.

## Flags {#flags}

Uma flag é uma cor com que você marca uma transação para achá-la de novo: um jantar que a empresa
vai reembolsar, os gastos de uma viagem, uma conta para guardar para o imposto de renda. São seis:
vermelha, laranja, amarela, verde, azul e roxa. Uma transação tem uma flag ou nenhuma; isso não
muda nada no orçamento.

- Escolha uma no campo **Flag** do formulário, ou, numa transação que você abre, na linha
  **Flag**, que já muda na hora.
- Dê um nome a uma cor: em qualquer seletor de flag, **Editar nomes das flags**. A vermelha pode
  virar "Reembolsável" e a azul "Viagem". O nome aparece onde a flag aparece, só neste orçamento;
  deixe vazio para voltar ao nome da cor.
- Uma transferência tem uma flag em cada lado, separadas: marcar um lado deixa o outro como está.
- Uma [transação agendada](schedules.md#creating) também pode ter flag, e cada transação que ela
  lança vem com ela.

A flag aparece antes do favorecido nas listas. Para trabalhar com as transações marcadas,
**Filtros** mantém só algumas flags (ou as sem flag), **Selecionar** marca várias de uma vez, e os
[relatórios](reports.md#flags) podem contar só as flags escolhidas.

## Busca e filtros {#search}

A busca encontra nomes, categorias, memorandos e valores. **Filtros** restringem a lista por
período, categoria, favorecido, faixa de valor, situação de compensação e [flag](#flags).

## Várias de uma vez {#bulk}

**Selecionar** (ou um toque longo no celular) deixa você marcar várias transações, e então:

- **Definir categoria** ou **Definir data** para todas;
- marcar uma **Flag**, ou tirá-la;
- **Compensar** ou **Descompensar**;
- excluí-las.

As transações que não aceitam a mudança ficam como estavam, e o Moneta diz quantas: uma dividida,
uma de conta de acompanhamento ou uma transferência entre contas do orçamento não recebem
categoria, uma conciliada continua compensada, e as de uma conta encerrada não mudam.

## Desfazer {#undo}

Logo depois de algumas mudanças, uma mensagem oferece **Desfazer**:

- excluir uma ou várias transações;
- mudar várias transações de uma vez;
- atribuir pela tela de uma categoria, mover dinheiro e a atribuição rápida;
- importar um extrato;
- pular ou excluir uma transação agendada;
- excluir uma categoria ou um grupo;
- excluir, mesclar ou remover favorecidos sem uso, e excluir uma regra de importação;
- excluir uma conta.

Só a última mudança pode ser desfeita, e só enquanto nada do que ela mexeu tiver mudado de novo.
