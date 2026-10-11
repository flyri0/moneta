# Importar extratos

Em vez de digitar cada transação, você pode importar o extrato que o seu banco exporta. Abra a
conta e escolha **Importar**, depois escolha o arquivo.

## Arquivos aceitos {#formats}

- **OFX** (e QFX): o formato próprio dos bancos, lido como está.
- **CSV**: uma tabela. O Moneta pergunta qual coluna tem o quê.

Exporte uma conta por vez: um arquivo com os extratos de várias contas é recusado. Importe-o na
conta de onde ele veio.

## Colunas do CSV {#csv-columns}

Para um arquivo CSV, diga ao Moneta:

- se **a primeira linha tem os nomes das colunas**;
- qual coluna é a **data**, a **descrição** e, se houver, a **observação**;
- se os **valores** estão numa coluna só (negativos para saídas) ou em colunas separadas de
  **entrada** e **saída**;
- o **formato da data** e o **formato dos números** que o banco usa;
- **Inverter sinais**, para faturas de cartão que mostram as compras como valores positivos.

A prévia mostra como as linhas ficam. O Moneta lembra essas escolhas para a próxima importação na
mesma conta. Linhas sem data ou valor ficam de fora, e o Moneta diz quantas.

![As colunas de um extrato CSV: data, descrição e valor, os formatos de data e de números, e uma prévia de como as linhas são lidas.](img/csv-light.pt-BR.png)

## Revisar as linhas {#matching}

Antes de gravar qualquer coisa, cada linha é marcada:

- **Nova**: vira uma transação nova, compensada.
- **Corresponde**: você já lançou essa transação à mão, com o mesmo valor e data até quatro dias
  de diferença. Importar marca a sua como compensada e mantém todo o resto dela; nada é duplicado.
- **Talvez seja**: você lançou uma transação com o mesmo valor, até dez dias de diferença.
  A linha começa desmarcada; **Vincular** a torna correspondente, ou marque-a para importá-la como
  nova.
- **Já importada**: essa linha já entrou antes. Importar o mesmo extrato duas vezes, ou dois
  extratos que se sobrepõem, não adiciona nada. Duas linhas iguais no mesmo arquivo são duas
  compras, e as duas entram.

![A revisão de um extrato importado: uma linha que corresponde a uma transação lançada à mão, duas linhas novas esperando uma categoria, e uma linha repetida já importada.](img/import-light.pt-BR.png)

Nas linhas novas você pode mudar o favorecido e a categoria. O Moneta preenche a categoria com a
categoria padrão do favorecido ou a que ele costuma ter. As linhas ainda sem categoria são
listadas, e você pode dar uma categoria a todas de uma vez.

**Importar** grava tudo de uma vez, e dá para desfazer logo em seguida.

> Algumas linhas começam desmarcadas, com um aviso no topo: linhas com data a mais de dois anos de
> hoje, que costumam indicar um formato de data errado, e linhas anteriores ao saldo inicial da
> conta, que provavelmente já as inclui. Marque uma para importá-la mesmo assim.

## Criar uma regra {#rules}

As descrições dos bancos são bagunçadas: `PAG*MERCADINHO 0423 SAO PAULO`. Numa linha nova que
nenhuma regra pega ainda, **Criar regra** define o favorecido (e, se quiser, uma categoria) para
toda descrição parecida, nesta importação e nas próximas. Depois do prefixo de uma maquininha, como
`PAG*` ou `SQ *`, a regra começa como **Contém** o nome da loja. As linhas pegas por uma regra
mostram a marca **Regra** e, sem categoria própria, recebem a categoria de costume do favorecido.
Veja [Regras de importação](payees.md#payee-rules).
