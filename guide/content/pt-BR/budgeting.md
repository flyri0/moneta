# Como o orçamento funciona

A tela do orçamento mostra um mês por vez. No topo fica o **Pronto para atribuir**; abaixo, suas
categorias nos grupos, cada uma com três números: **Atribuído**, **Movimento** e **Disponível**.
Use as setas ao lado do mês, ou toque no nome dele, para trocar de mês.

## Dê uma função a cada real {#zero-based}

O Moneta orça o dinheiro que você tem agora, não o que espera receber. Quando entra renda numa
conta que está no orçamento, ela soma ao Pronto para atribuir. Aí você a atribui às categorias,
que funcionam como envelopes: o que está em Mercado é para o mercado. O objetivo é um Pronto para
atribuir igual a zero, com todo o dinheiro em alguma categoria.

## Pronto para atribuir {#ready-to-assign}

O Pronto para atribuir é o dinheiro que ainda não tem função. Toque nele para ver a conta:

![O Pronto para atribuir aberto: dinheiro disponível, menos o gasto a mais do mês passado, menos o atribuído neste mês.](img/ready-to-assign-light.pt-BR.png)

| Linha                       | O que é                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Dinheiro disponível         | O que sobrou do mês passado, mais a renda deste mês                                    |
| Gasto a mais no mês passado | O gasto a mais do mês passado que não foi coberto (veja [gasto a mais](#overspending)) |
| Atribuído neste mês         | Tudo o que foi atribuído às categorias neste mês                                       |

- **Positivo:** dinheiro esperando uma função. Atribua.
- **Zero:** todo o dinheiro tem função.
- **Negativo:** você atribuiu mais do que tem. Retire de alguma categoria, ou registre a renda que
  está faltando.

O Pronto para atribuir nunca é guardado: o Moneta calcula a partir das suas transações e do que
você atribuiu, toda vez. A renda conta no mês da data dela, então um salário com data do dia 30
soma àquele mês.

## Atribuir dinheiro {#assigning}

Toque numa categoria para abrir a tela dela e digite quanto ela recebe neste mês em **Atribuído
neste mês**. Os valores aceitam contas simples: `120+35` ou `400/2`. Salva pela tela da
categoria, a mudança pode ser desfeita logo em seguida.

Numa tela larga, o orçamento vira uma tabela e você também pode digitar direto na coluna
**Atribuído** de uma categoria. Ali, **Enter** salva e passa para a próxima categoria
(**Shift+Enter** para a anterior), as setas **↑** e **↓** também mudam de categoria, e **Esc**
descarta o que você digitou. As mudanças feitas na coluna não oferecem desfazer.

- **Movimento** é o que foi gasto (ou recebido) na categoria neste mês, pelas suas transações.
- **Disponível** é o que sobra: o que veio do mês passado, mais o Atribuído, mais o Movimento.

Você pode atribuir adiantado em meses futuros, para uma conta que vence depois. Se isso deixar o
Pronto para atribuir de um mês futuro abaixo de zero, o Moneta avisa em qual mês acontece.

### Mover dinheiro entre categorias {#move-money}

Planos mudam. Abra uma categoria e use **Mover dinheiro**: escolha outra categoria e um valor, e
ele passa de uma para a outra neste mês. Cada movimentação pode ser desfeita logo em seguida (veja
[Desfazer](transactions.md#undo)).

![A tela de uma categoria: o disponível, o atribuído neste mês, e Atribuição rápida, Mover dinheiro, Meta e Levar gasto a mais adiante.](img/category-light.pt-BR.png)

## Gasto a mais {#overspending}

Quando uma categoria gasta mais do que tinha, o Disponível fica negativo e aparece em vermelho, e
um aviso no topo mostra quanto foi gasto a mais; **Revisar** abre a primeira categoria nessa
situação. Você pode cobrir de dois jeitos:

- **Cobrir com o Pronto para atribuir**, quando há dinheiro sem função.
- **Tirar de outra categoria** que tenha dinheiro sobrando.

Se ficar sem cobrir, o mês fecha com a categoria abaixo de zero. No mês seguinte, a categoria
recomeça do zero, e o valor sai do Pronto para atribuir do mês seguinte como **Gasto a mais no mês
passado**. O dinheiro foi gasto; o orçamento precisa dar conta dele em algum lugar.

## Levar o gasto a mais adiante {#carryover}

Em algumas categorias você prefere manter a dívida na própria categoria, por exemplo uma que você
enche um pouco todo mês e às vezes gasta antes. Ative **Levar gasto a mais adiante** na categoria:
o Disponível negativo continua nela no mês seguinte, e o Pronto para atribuir fica intocado. Você
repõe a categoria atribuindo a ela.

O que sobra numa categoria sempre passa para o mês seguinte, independentemente dessa opção.

## Atribuição rápida {#quick-assign}

A **Atribuição rápida** define o que é atribuído neste mês para um grupo inteiro (toque no nome do
grupo) ou para uma categoria (toque na categoria):

- **Igual ao mês passado**: o que cada categoria recebeu no mês passado.
- **Média gasta (3, 6 ou 12 meses)**: quanto cada categoria gastou em média.
- **Cobrir gasto a mais**: o suficiente para trazer as categorias negativas de volta a zero.
- **Cumprir metas**: o que a meta de cada categoria pede neste mês.
- **Zerar**: não atribuir nada.

As opções que não mudariam nada ficam de fora. A atribuição rápida pode ser desfeita logo em
seguida.

## Metas {#goals}

Uma categoria pode ter uma meta: toque na categoria e depois em **Meta**. Há dois tipos:

- **Todo mês**: atribuir este valor todo mês. Para contas fixas e gastos do dia a dia.
- **Juntar**: levar o saldo da categoria até um valor, para reservas e gastos maiores. Opcionalmente
  **até um mês**: o Moneta divide o que falta pelos meses até lá, arredondando para cima para o
  último mês nunca ficar curto.

A categoria mostra quanto ainda falta neste mês, ou **Meta cumprida**. Uma meta de juntar conta a
partir do saldo com que o mês começou, então o que ela pede não muda enquanto você atribui durante
o mês. **Cumprir metas** na Atribuição rápida atribui de uma vez o que as metas pedem; ela só
aumenta valores, e deixa como estão as categorias sem meta.

## Grupos, ordem e categorias ocultas {#categories}

- **Grupos** reúnem categorias (Contas fixas, Dia a dia…). Adicione um com **Adicionar grupo**;
  toque no nome de um grupo para criar uma categoria nele, usar a Atribuição rápida nele ou
  excluí-lo, e abra **Configurações do grupo** para renomeá-lo ou ocultá-lo. Toque na seta para
  recolhê-lo.
- **Reordenar** deixa você arrastar grupos e categorias, ou movê-los com as setas.
- **Ocultar** uma categoria ou um grupo mantém o histórico e o dinheiro, mas os tira da tela do
  orçamento. Os dois ficam no fim, em **Ocultos**: para trazer um de volta, toque nele, abra
  **Configurações da categoria** (ou **Configurações do grupo**) e desligue **Oculta** (ou
  **Oculto**). Ocultar um grupo oculta todas as categorias dele.
- **Excluir** uma categoria que já foi usada pergunta para onde vão as transações e o dinheiro
  atribuído. Excluir um grupo move as categorias dele para o grupo que você escolher.

O grupo **Receitas** é cuidado pelo Moneta: as categorias de receita mandam o dinheiro direto para
o Pronto para atribuir, em vez de guardá-lo.
