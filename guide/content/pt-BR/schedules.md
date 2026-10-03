# Agendamentos

Aluguel, salário, assinaturas: transações que se repetem podem ser agendadas uma vez e depois
lançadas sozinhas, ou com um toque. Elas ficam em **Agendamentos** na barra lateral, ou na aba **Agendadas** de Transações no celular.

## Criar um agendamento {#creating}

**Novo agendamento** pede os mesmos campos de uma transação (conta, favorecido, valor, categoria e
memorando), e mais:

- **Próxima data**: a primeira ocorrência.
- **Repetição**: uma vez, diária, semanal, mensal ou anual, e **a cada** quantos dias, semanas,
  meses ou anos.
- **Termina**: nunca, numa data, ou depois de um número de vezes.
- **Em fins de semana**: o que acontece quando uma data cai num sábado ou domingo.
- **Lançar automaticamente**: ligado ou desligado.

Um agendamento mensal no dia 31 cai no último dia dos meses mais curtos, e volta ao dia 31 quando o
mês tem um.

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

Editar um agendamento muda as ocorrências que ainda vêm. Excluí-lo mantém as transações que ele já
lançou.
