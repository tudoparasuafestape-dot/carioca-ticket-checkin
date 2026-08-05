# Carioca Ticket — Check-in externo

Este pacote contém o leitor de QR Code externo, pronto para publicar no GitHub Pages.

## Arquivos para o GitHub

Envie para a raiz do repositório:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icon-192.png`
- `icon-512.png`

## Arquivos para o Google Apps Script

- Substitua o conteúdo de `Menu.gs` pelo arquivo `Menu.gs` deste pacote.
- Crie um novo arquivo de script chamado `ApiCheckin.gs` e cole o conteúdo correspondente.
- Garanta que não exista outra função `doGet()` no projeto.
- Atualize a implantação existente: **Implantar → Gerenciar implantações → Editar → Nova versão → Atualizar**.

## Publicar no GitHub Pages

1. Abra o repositório.
2. Envie os arquivos acima.
3. Acesse **Settings → Pages**.
4. Em **Build and deployment**, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
5. Salve.
6. Aguarde o GitHub exibir a URL pública.

## Primeira configuração no celular

1. Abra a página do GitHub Pages.
2. Toque na engrenagem.
3. Cole a URL `/exec` do aplicativo da web do Apps Script.
4. Toque em **Testar conexão**.
5. Salve.
6. Inicie a câmera.

A URL fica salva somente naquele aparelho.
