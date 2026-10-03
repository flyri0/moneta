# Favorecidos e regras

Favorecidos são a quem você paga e quem paga você. Eles são criados conforme você os digita nas
transações, e **Favorecidos** (na barra lateral, ou um botão em Transações no celular) lista todos com quantas transações cada um
tem.

## Editar um favorecido {#editing}

Toque num favorecido para:

- **renomeá-lo**, em todo lugar onde aparece;
- dar a ele uma **categoria padrão**: as novas transações com esse favorecido começam com ela. Sem
  uma, o Moneta sugere a categoria usada da última vez;
- **mesclá-lo** com outro favorecido: as transações dele passam para o outro e ele é excluído. Útil
  quando a mesma loja foi digitada de dois jeitos. Renomear para um nome que já existe oferece o
  mesmo.
- **excluí-lo**, quando nenhuma transação, agendamento ou regra o usa.

**Remover sem uso** exclui de uma vez todos os favorecidos sem transações. Um favorecido volta se
você o digitar de novo.

## Regras de importação {#payee-rules}

Uma regra transforma a descrição do banco num favorecido quando você importa um extrato. Cada regra
tem:

- **Quando a descrição**: **Começa com**, **Contém** ou **É exatamente** um texto. Maiúsculas,
  acentos e espaços a mais são ignorados.
- **Usar favorecido**: o favorecido que a linha recebe.
- **Categoria**: uma das suas categorias, ou **a categoria de costume do favorecido**.

Criada a partir de uma linha da importação, o formulário diz se a regra pega a descrição daquela
linha.

Quando várias regras pegam a mesma descrição, vence a mais específica: **É exatamente**, depois
**Começa com**, depois **Contém**; entre regras do mesmo tipo, a de texto mais longo.

Adicione regras em **Regras de importação** de um favorecido, ou a partir de uma linha durante a
importação, com **Criar regra**. As regras só agem nas importações; nunca mudam transações que você
já tem.
