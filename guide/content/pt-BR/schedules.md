# Agendamentos

Aluguel, salário, assinaturas: transações que se repetem podem ser agendadas uma vez e depois
lançadas sozinhas, ou com um toque. Elas ficam em **Agendamentos** na barra lateral, ou na aba **Agendadas** de Transações no celular.

## Criar um agendamento {#creating}

**Novo agendamento** pede os mesmos campos de uma transação (conta, favorecido, valor, categoria,
memorando e [flag](transactions.md#flags)), e mais:

- **Próxima data**: a primeira ocorrência.
- **Repetição**: uma vez, diária, semanal, mensal ou anual, e **a cada** quantos dias, semanas,
  meses ou anos.
- **Termina**: nunca, numa data, ou depois de um número de vezes.
- **Em fins de semana**: o que acontece quando uma data cai num sábado ou domingo.
- **Lançar automaticamente**: ligado ou desligado.
- **Parcelas**, numa compra no cartão, no alto de **Repetição**: uma compra que você já está
  pagando, numerada a cada parcela (veja [abaixo](#installments-under-way)).

Um agendamento mensal no dia 31 cai no último dia dos meses mais curtos, e volta ao dia 31 quando o
mês tem um.

## Parcelamentos em andamento {#installments-under-way}

Uma compra parcelada que começou antes de você usar o Moneta, ou que você nunca lançou, ainda pode
ser agendada a partir da parcela em que você está. Para uma compra lançada agora, use **Parcelas**
na própria transação ([Parcelas](accounts.md#installments)).

Escolha o cartão num novo agendamento, ou toque em **Já está pagando uma? Adicione como
agendamento**, abaixo de Parcelas, numa compra no cartão. Depois:

1. Preencha o favorecido, a categoria e o memorando, e em **Valor** quanto custa **cada** parcela.
2. Abra **Repetição**, ligue **Parcelas**, e informe a **próxima parcela** e o total, como a fatura mostra: para
   "4/12", 4 de 12.

Por exemplo, uma TV em 12x de R$ 80,00, com três já pagas: o agendamento lança de 4/12 a 12/12,
nove parcelas, R$ 720,00 no total, com o memorando numerado ("TV 4/12").

Elas seguem as mesmas regras de uma compra parcelada nova:

- Só uma compra no cartão as oferece: não uma transferência, uma entrada ou uma divisão. Troque de
  conta e a opção some.
- Repetem todo mês e terminam na última, então o agendamento não pergunta como se repete.
- Num cartão com fechamento e vencimento, cada uma cai no vencimento da sua fatura, a próxima no
  próximo vencimento a partir de hoje, e você não escolhe a data. Sem essas datas, você escolhe a
  data da próxima.
- São lançadas automaticamente, como as parcelas de uma compra nova. Dá para desligar.

As parcelas que você já pagou não são lançadas: os meses passados do orçamento ficam como estão.
Para corrigir os números depois, edite o agendamento e mude-os em **Repetição**.

## Busca e filtros {#search}

A caixa de busca encontra agendamentos pelo favorecido, conta, categoria, memorando ou valor, sem
diferenciar acentos nem maiúsculas. Todas as palavras precisam bater. **Filtros** restringem a
lista por próxima data, conta, categoria, favorecido, valor, situação (pendentes, próximos,
pausados ou encerrados) e tipo: lançados automaticamente, lançados à mão ou parcelados. **Limpar
filtros** mostra todos de novo.

## Fins de semana {#weekend-rule}

Bancos não movem dinheiro no fim de semana. Para uma ocorrência num sábado ou domingo, você pode:

- **Manter a data**;
- **Antecipar para a sexta**, como costuma acontecer com o salário;
- **Adiar para a segunda**, como costuma acontecer com uma conta.

Agendamentos diários sempre mantêm as datas.

## Automático ou à mão {#auto-enter}

- **Lançar automaticamente**: o Moneta lança a transação na data dela, na próxima vez que o app
  estiver aberto. Se você abrir depois de alguns dias, ele lança todas as datas que perdeu, cada
  uma na sua data.
- Senão a ocorrência espera na conta como **pendente** até você **Lançar** (dá para ajustar antes,
  para uma conta que mudou de valor) ou **Pular**.

Se você salvar um agendamento automático com a primeira data no passado, o Moneta diz quantas
transações vai lançar na hora, para um ano errado não encher o seu extrato.

## O que vem por aí {#upcoming}

![Os agendamentos: aluguel e o pagamento do cartão à mão, e um salário lançado automaticamente.](img/schedules-light.pt-BR.png)

Cada conta lista as ocorrências dos próximos 30 dias e o saldo **previsto**, para você ver se o
dinheiro vai estar lá. A tela de agendamentos os separa em **Pendentes**, **Próximos** e **Pausados
ou encerrados**. Um agendamento fica pausado quando a conta dele é encerrada.

Tocar num agendamento abre o resumo dele: valor, conta, categoria, como ele se repete (ou qual
parcela vem e quantas faltam) e as próximas datas. Dali, **Lançar próxima** ou **Pular próxima**
cuida da próxima ocorrência, e **Editar agendamento** ou **Excluir agendamento** fica a um toque. Numa
conta, **Ver agendamento** abre o mesmo resumo.

Editar um agendamento muda as ocorrências que ainda vêm. Excluí-lo mantém as transações que ele já
lançou.
