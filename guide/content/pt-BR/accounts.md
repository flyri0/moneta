# Contas

As contas guardam suas transações: uma conta corrente, a carteira, um cartão de crédito, um
empréstimo. **Contas** lista todas com os saldos, e tocar numa abre o extrato dela.

## Contas do orçamento e de acompanhamento {#account-kinds}

Ao adicionar uma conta, você primeiro escolhe o tipo. Os tipos se dividem em dois grupos:

- **No orçamento**: conta corrente, poupança, dinheiro e cartão de crédito. Contas de onde você
  pretende gastar em breve. O dinheiro delas é orçado em categorias: a renda que entra nelas soma
  ao Pronto para atribuir, e toda transação precisa de uma categoria.
- **Acompanhamento**: investimentos, empréstimos e outros bens ou dívidas. Contam no seu
  patrimônio líquido, mas ficam fora do orçamento, e as transações delas não têm categoria.

![Adicionando uma conta: os tipos no orçamento (corrente, poupança, dinheiro, cartão de crédito) em cima, os de acompanhamento (investimento, empréstimo, outro) embaixo.](img/account-types-light.pt-BR.png)

Cada tipo começa no orçamento ou de acompanhamento, como listado, e **No orçamento** no formulário
muda isso ao adicionar a conta; cartões de crédito estão sempre no orçamento. Nem o tipo nem essa
escolha mudam depois que a conta existe: os ajustes
dela servem para renomeá-la, dar a ela um emoji como **Ícone** no lugar do ícone do tipo, informar
o fechamento e o vencimento de um cartão, e encerrá-la ou excluí-la. Se escolheu o tipo errado,
adicione a conta de novo com o tipo certo e mude a conta das transações dela.

## Saldo inicial {#starting-balance}

Uma conta nova pede o **saldo atual** (num cartão ou empréstimo, o **valor devido**) e a data a
que ele se refere. O Moneta o registra como a primeira transação da conta, um saldo inicial.

Numa conta do orçamento, o saldo inicial vai para a **Categoria do saldo inicial** que você escolhe
no mesmo formulário (a primeira conta, adicionada ao criar o orçamento, sempre usa **Saldo inicial**), normalmente **Saldo inicial** no grupo Receitas, então o dinheiro que você já
tem cai no Pronto para atribuir. A dívida inicial de um cartão, nessa mesma categoria, sai do
Pronto para atribuir: o dinheiro para pagá-la tem que vir de algum lugar. Para quitar uma dívida
antiga aos poucos, veja [Um cartão de crédito que já tem dívida](situations.md#existing-card-debt).

## Cartões de crédito {#credit-cards}

O Moneta trata uma compra no cartão como qualquer outro gasto: tira o dinheiro da categoria da
compra na hora, no dia em que você compra. O saldo do cartão mostra quanto você deve.

Pagar a fatura é uma **transferência** da conta corrente para o cartão. Ela move dinheiro entre
duas contas do orçamento, então não tem categoria e não mexe no orçamento: as categorias já foram
cobradas na compra. Enquanto suas categorias não ficarem negativas, o dinheiro da fatura está lá.

Uma compra que você ainda não consegue cobrir deixa a categoria com gasto a mais, como qualquer
gasto (veja [Gasto a mais](budgeting.md#overspending)).

### Fechamento e vencimento {#card-billing}

Nos ajustes do cartão você pode informar o **dia do fechamento** (quando a fatura fecha) e o **dia
do vencimento** (quando ela deve ser paga), de 1 a 31. Os dois são opcionais, mas informe os dois
ou nenhum. Um dia depois do fim de um mês curto cai no último dia dele. O Moneta os usa para datar
as parcelas.

### Parcelas {#installments}

Uma compra no cartão de crédito pode ser parcelada: preencha **Parcelas** (de 2 a 99) ao
lançá-la. O Moneta mostra o plano antes de salvar, por exemplo "1ª de R$ 333,34 e 2x de R$ 333,33": a primeira parcela leva os centavos que sobram.

![Uma compra de R$ 1.000,00 no cartão em 10 parcelas: o plano mostra as 10 parcelas e a data do primeiro vencimento.](img/installments-light.pt-BR.png)

- A primeira parcela é lançada agora; as demais viram um agendamento que lança cada uma sozinho, um
  mês depois da outra, com o memorando numerado ("TV 2/12").
- Num cartão com fechamento e vencimento, cada parcela, inclusive a primeira, vai para a data de
  vencimento da sua fatura. Uma compra no dia do fechamento vai para a fatura seguinte.
- Cada parcela é cobrada da categoria no mês em que é lançada, então o orçamento acompanha o que
  você paga a cada mês.

As parcelas restantes aparecem em **Agendamentos**, como "Parcela 2 de 12", e na lista de próximos
lançamentos do cartão. Uma compra que você já vinha pagando entra como agendamento a partir da
próxima parcela: veja [Parcelamentos em andamento](schedules.md#installments-under-way).

## O extrato {#register}

O extrato de uma conta lista as transações, das mais novas às mais antigas. No topo você vê o saldo **compensado** (o que o banco já viu), o valor **não
compensado** e o total. Os saldos são os de hoje: uma transação com data futura, como uma parcela no
vencimento da fatura, aparece como **Futura** e conta a partir do dia dela. Até lá o extrato mostra
também o saldo **Com as futuras**. Marque uma transação como compensada pela caixa de seleção quando ela
aparecer no extrato do banco.

O dinheiro que entra aparece em verde com **+**, o que sai com **-**, do mesmo jeito em todo o
app. Saldos e totais não têm cor.

Cada conta também mostra o que vem nos próximos 30 dias pelos agendamentos, e o saldo **previsto
em 30 dias**. Veja [Agendamentos](schedules.md).

## Conciliar {#reconcile}

Conciliar confere seus registros com o banco. Abra a conta e escolha **Conciliar**:

1. O Moneta pergunta se o banco mostra o seu saldo compensado. Se mostra, **Sim, conciliar**.
2. Se não mostra, informe o saldo no banco (e a data). O Moneta mostra a diferença.
3. Procure no extrato do banco transações que faltam ou não estão marcadas como compensadas, e
   corrija. Ou, se aceitar a diferença, **Lançar ajuste e conciliar**, com uma categoria para ela.

![Conciliando a conta corrente: o Moneta mostra o saldo compensado e pergunta se o banco mostra o mesmo.](img/reconcile-light.pt-BR.png)

Conciliar trava o que você conferiu: as transações conciliadas continuam compensadas, e a conta
mostra a data da última conciliação. Você ainda pode editá-las, mas o Moneta avisa que mudar valor,
data ou conta muda um saldo que você já conferiu com o banco.

## Encerrar e excluir {#closing}

- **Encerrar conta** quando você parar de usá-la. É preciso saldo zero: mova o que sobrou ou quite
  antes. Uma conta encerrada mantém o histórico, aparece em **Encerradas**, e pode ser reaberta. Os
  agendamentos de uma conta encerrada ficam pausados.
- **Excluir conta** é só para contas sem transações nem agendamentos, como uma criada por engano.
