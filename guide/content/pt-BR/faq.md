# Solução de problemas

## "O Moneta está aberto em outra aba" {#another-tab}

Um orçamento só pode estar aberto em um lugar por vez. Feche a outra aba ou janela, ou escolha
**Usar o Moneta aqui**. Se a outra aba não responder (o celular pode tê-la congelado em segundo
plano), **Abrir aqui mesmo assim** assume; o que a outra aba ainda não tinha salvo se perde. O app
instalado e uma aba do navegador contam como dois lugares.

## "O armazenamento não está disponível" {#storage-unavailable}

O Moneta precisa do armazenamento privado do navegador para o site. Janelas anônimas ou privadas, e
alguns navegadores antigos, o bloqueiam. Abra o Moneta numa janela normal de um navegador
atualizado.

## "O armazenamento está cheio" {#storage-full}

O dispositivo não tem mais espaço para o seu orçamento. Libere espaço e recarregue. Seu orçamento
não é afetado.

## Meu orçamento sumiu {#budget-gone}

Os dados do navegador para o site foram apagados: por você, por um app de limpeza, ou pelo próprio
navegador para liberar espaço (o Safari também apaga sites que você não abre há uma semana, a não
ser que o Moneta esteja instalado). Restaure o último backup: **Ajustes → Backup → Restaurar um
backup**, ou **Restaurar do Google Drive**. Para não acontecer de novo, instale o Moneta e ative a
**Proteção dos dados** em **Ajustes → Armazenamento**. Veja [Seus dados e
backups](data.md#clearing-site-data).

## Esqueci a senha dos backups {#forgot-password}

Restaure com a chave de recuperação: na tela de desbloqueio, escolha **Usar a chave de
recuperação**. Depois, num dispositivo onde o Moneta está configurado, **Trocar a senha** para os
próximos backups. Sem a senha nem a chave de recuperação, ninguém consegue abrir um backup
criptografado.

## Trocar de celular ou computador {#new-device}

1. No dispositivo antigo, **Fazer backup agora**, e leve o arquivo `.moneta` para o novo (ou deixe
   o backup automático no Google Drive rodar).
2. No dispositivo novo, abra o Moneta. A configuração inicial oferece **Já tem um backup?**:
   restaure o arquivo, ou restaure do Google Drive.
3. Informe a senha ou a chave de recuperação do backup, se ele for criptografado.

## Um backup foi feito por um Moneta mais novo {#too-new}

Um orçamento ou backup salvo por uma versão mais nova precisa dessa versão para abrir. Recarregue o
Moneta, ou use **Procurar atualização** em **Ajustes → Sobre**, e tente de novo.

## Algo parece errado depois de uma atualização {#after-update}

Antes de uma atualização mudar o jeito como um orçamento é guardado, o Moneta salva uma cópia dele.
Restaure uma em **Ajustes → Backup → Cópias salvas** como um novo orçamento e compare.

## O guia não abre offline {#guide-offline}

O Moneta funciona offline, mas este guia não: ele não é baixado junto com o app, para a instalação
e as atualizações continuarem leves. Abra de novo quando estiver online. Seu orçamento não é
afetado.

## Relatar um problema {#report}

O Moneta é código aberto. Relate erros no [GitHub](https://github.com/flyri0/moneta/issues), com um
orçamento de teste: os relatos são públicos, então nunca anexe um backup do seu orçamento de
verdade nem capturas de tela dos seus saldos reais.
