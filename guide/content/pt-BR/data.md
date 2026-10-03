# Seus dados e backups

## Onde fica o seu orçamento {#storage}

Cada orçamento é um arquivo de banco de dados SQLite no armazenamento privado do navegador para o
site (o Origin Private File System). Nada sai do seu dispositivo, a não ser que você ative os
backups automáticos, e mesmo assim só criptografado.

### Limpar os dados do site apaga o orçamento {#clearing-site-data}

Como o orçamento fica no armazenamento do navegador, **limpar os dados do site o apaga**: pelos
ajustes do navegador, por um "limpar dados de navegação" que inclua os dados dos sites, ou
desinstalando o navegador. Perder o dispositivo também. Guarde um backup em outro lugar.

Em **Ajustes → Armazenamento**, **Proteção dos dados** pede ao navegador que não apague seu
orçamento quando faltar espaço no dispositivo. Alguns navegadores decidem sozinhos, e costumam
proteger os apps instalados. A mesma seção mostra quanto espaço o Moneta usa.

## Vários orçamentos {#budget-files}

Você pode manter vários orçamentos lado a lado: o seu e um da família, ou um de teste. **Ajustes →
Arquivos de orçamento** lista todos; **Novo orçamento** cria outro, e **Abrir** troca. Cada
orçamento tem as próprias contas, categorias, moeda e formato de números (**Detalhes do
orçamento**).

Excluir um orçamento pede que você digite o nome dele e espera alguns segundos antes de apagar:
ele exclui o orçamento e as cópias salvas dele para sempre.

## Backups {#backups}

**Ajustes → Backup → Fazer backup agora** salva todos os orçamentos do dispositivo num único
arquivo `.moneta`. O Chrome e o Edge no computador perguntam onde salvar; os outros navegadores
baixam o arquivo, e o Moneta pergunta se o download deu certo. Guarde-o fora do dispositivo: na sua nuvem, num computador,
num pen drive. O Moneta avisa quando o último backup tem mais de duas semanas.

![Ajustes → Backup: Fazer backup agora, Restaurar um backup, Backup automático, Criptografia e Exportações.](img/backup-light.pt-BR.png)

**Restaurar um backup** lê um arquivo `.moneta` (ou um `.sqlite` antigo) e deixa você escolher
quais orçamentos restaurar:

- um orçamento que não está no dispositivo é adicionado;
- um orçamento que já está é **substituído** pelo backup. O que ele tinha fica em **Cópias
  salvas**, então uma restauração errada pode ser revertida.

## Cópias salvas {#saved-copies}

O Moneta também salva uma cópia de um orçamento sozinho:

- antes de uma atualização mudar o jeito como o orçamento é guardado (ficam as três últimas);
- quando uma restauração o substitui.

Em **Ajustes → Backup → Cópias salvas** você pode restaurar uma cópia como um novo orçamento, ou
baixá-la.

## Backups criptografados {#encryption}

Ative **Criptografar backups** para proteger os próprios arquivos. Quem tem um backup sem
criptografia consegue ler todas as transações dele.

1. Escolha uma senha. O Moneta avalia se ela é fácil de adivinhar; algumas palavras sem relação
   entre si formam uma senha difícil de adivinhar e fácil de lembrar.
2. Guarde a **chave de recuperação** que ele mostra (veja abaixo).

Daí em diante, fazer backup continua sem pedir nada: o Moneta guarda a chave neste dispositivo.
**Restaurar** um backup criptografado pede a senha ou a chave de recuperação.

- **Conferir a senha** confirma que você ainda se lembra dela.
- **Trocar a senha** vale para os backups feitos daí em diante; os antigos mantêm a senha e a chave
  de recuperação antigas.
- Desligar a criptografia deixa os backups feitos antes ainda criptografados.

Os backups são criptografados com AES-256-GCM, com uma chave derivada da sua senha (PBKDF2-SHA256)
ou da chave de recuperação.

### A chave de recuperação {#recovery-key}

A chave de recuperação abre seus backups criptografados se você esquecer a senha. Copie-a para um
gerenciador de senhas, ou salve como arquivo e imprima, e guarde-a **longe dos seus backups**.

> Se você perder a senha e a chave de recuperação, ninguém consegue abrir esses backups, nem o
> Moneta. Não há como redefinir.

## Backups automáticos no Google Drive {#google-drive}

Conecte seu Google Drive uma vez (**Ajustes → Backup → Backup automático**), e o Moneta salva
sozinho um backup criptografado de todos os orçamentos numa pasta Moneta lá.

- É preciso ativar a criptografia dos backups antes: os backups na nuvem são sempre criptografados.
- Ele faz backup dois minutos depois que você para de fazer mudanças, quando você sai do app com
  uma mudança pendente, e ao abrir quando o último backup tem um dia. Só funciona enquanto o Moneta
  está aberto.
- Cada dispositivo mantém um arquivo por dia: o mais novo e os dos cinco dias anteriores. Os mais
  antigos são apagados.
- O Moneta só enxerga os arquivos que ele mesmo criou no seu Drive.

**Restaurar do Google Drive** lista os backups de lá, do mais novo ao mais antigo, com o
dispositivo que fez cada um. Num dispositivo novo, conecte, escolha um e informe a senha ou a chave
de recuperação.

**Desconectar** para os backups automáticos; os arquivos já salvos continuam no seu Drive.

> Essa opção só existe onde o site que serve o Moneta configurou o login do Google. Uma cópia que
> você hospeda pode não mostrá-la.

## Exportações {#exports}

Em **Ajustes → Backup → Exportações**, **Transações (CSV)** e **Orçamento inteiro (JSON)**
exportam o orçamento aberto para planilhas e outros apps. Eles não podem ser restaurados no Moneta e nunca são criptografados: guarde-os num lugar
seguro.

## Apagar tudo {#wipe}

**Apagar todos os dados deste dispositivo**, em **Ajustes → Armazenamento**, apaga todos os
orçamentos, todas as cópias salvas e a chave dos backups, e esquece seus ajustes. Só os seus
arquivos de backup podem trazê-los de volta.
