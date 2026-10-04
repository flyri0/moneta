# Primeiros passos

O Moneta é um orçamento base zero por envelopes, no espírito do YNAB e do Actual Budget. Você dá
uma função a cada real antes de gastá-lo: a renda cai em **Pronto para atribuir**, você a distribui
entre as categorias, e os gastos consomem essas categorias. Quando uma acaba, você decide de onde
vem o dinheiro, em vez de descobrir no fim do mês.

![A tela do orçamento: Pronto para atribuir no topo e, abaixo, os grupos de categorias com o que foi atribuído, gasto e ainda está disponível em cada uma.](img/budget-light.pt-BR.png)

## Seus dados ficam neste dispositivo {#your-data}

O Moneta roda inteiro no seu navegador. Não há conta para criar, nem servidor, nem rastreamento.
Cada orçamento é um arquivo de banco de dados guardado no armazenamento privado do navegador para o
site, e nunca sai do seu dispositivo por conta própria.

Essa é a ideia, mas tem uma consequência: **ninguém guarda uma cópia para você.** Limpar os dados
do site, ou perder o dispositivo, perde o orçamento. Faça backup em **Ajustes → Backup** a cada
duas semanas (o Moneta avisa quando o último backup tem mais de duas semanas), ou ative os backups
automáticos no seu Google Drive. Veja [Seus dados e backups](data.md).

## Veja uma demonstração {#demo}

Na página de boas-vindas, **Ver uma demonstração** abre um ano de dados de exemplo: contas, um
cartão de crédito, agendamentos e relatórios já preenchidos. Nada do que você faz ali é salvo.
Quando quiser, **Criar meu orçamento** na faixa do topo começa o seu.

## Instale como app {#install}

O Moneta funciona numa aba do navegador, mas instalado ele fica mais protegido e funciona offline.

- **Chrome, Edge e Android:** use **Instalar o Moneta** na página de boas-vindas, ou **Instalar**
  no menu do navegador.
- **iPhone e iPad:** toque no botão Compartilhar e depois em **Adicionar à Tela de Início**.
- **Safari no Mac:** abra o menu Arquivo e depois **Adicionar ao Dock**.
- **Firefox:** abra o menu do navegador e depois **Instalar**.

**Usar no navegador**, na página de boas-vindas, pula a instalação: mostra o aviso abaixo antes e
depois abre o Moneta.

> Numa aba do navegador, o navegador pode apagar os dados do site para liberar espaço, e o Safari
> pode apagá-los se você passar uma semana sem abrir o Moneta. Se ficar no navegador, faça backup
> com frequência.

As atualizações são baixadas sozinhas. Quando uma versão nova fica pronta, o Moneta oferece
recarregar; você também pode procurar uma em **Ajustes → Sobre → Atualizações**.

## Crie seu primeiro orçamento {#first-budget}

Na primeira vez que você abre o Moneta, alguns passos montam o seu orçamento:

1. **Boas-vindas**: como o Moneta funciona.
2. **Um ponto de atenção**: os backups ficam por sua conta. Aqui, **Já tem um backup?** restaura um
   arquivo `.moneta` (ou um `.sqlite` antigo) para trazer seus orçamentos de volta e pular o resto.
3. **Seu orçamento**: o nome, a moeda e o formato de números e datas.
4. **Suas categorias**: escolha numa lista inicial organizada em grupos, adicione as suas, ou
   comece sem nenhuma. O grupo Receitas é sempre criado.
5. **Sua primeira conta**: geralmente a conta corrente e o saldo atual dela. Dá para pular e
   adicionar contas depois.
6. **Tudo pronto**: o orçamento abre, com um tour rápido pelo básico: o Pronto para atribuir, as
   categorias, como lançar uma transação, as contas e os meses. **Pular** encerra o tour, e ele
   não volta sozinho; **Ajustes → Sobre → Fazer o tour** mostra de novo.

Um orçamento que você adiciona depois, em **Ajustes → Arquivos de orçamento → Novo orçamento**,
pede só os passos 3 a 5.

Depois:

1. Olhe o **Pronto para atribuir**: o dinheiro nas suas contas que ainda não tem função.
2. Atribua esse dinheiro às categorias até o Pronto para atribuir chegar a zero.
3. Registre o que gasta e recebe conforme acontece, ou importe os extratos do banco.

[Como o orçamento funciona](budgeting.md) explica cada número da tela do orçamento. Nunca usou
orçamento por envelopes? O [glossário](glossary.md) explica as palavras, e [Situações do dia a
dia](situations.md) mostra como registrar estornos, contas anuais, dívida de cartão e mais.

## Uma aba por vez {#one-tab}

Um orçamento só pode estar aberto em uma aba ou janela por vez. Se o Moneta já estiver aberto em
outro lugar, a nova aba avisa e oferece **Usar o Moneta aqui**, que pede para a outra aba sair.
Se a outra aba estiver congelada em segundo plano, feche-a, ou use **Abrir aqui mesmo assim**: o
que a outra aba ainda não tinha salvo se perde.

## Onde fica cada coisa {#navigation}

No celular, a barra de baixo tem Orçamento, Transações, Contas, Relatórios e Ajustes, e o botão
flutuante adiciona uma transação. Favorecidos e agendamentos ficam dentro de Transações: um botão
**Favorecidos** e a aba **Agendadas**. Numa tela maior, a barra lateral à esquerda lista todos,
inclusive Favorecidos e Agendamentos, com suas contas e saldos logo abaixo. Arraste a borda dela
para alargá-la ou estreitá-la, ou recolha-a para mostrar só os ícones.

![O Moneta no celular: o orçamento, uma nova transação e os relatórios.](img/phone.pt-BR.png)
