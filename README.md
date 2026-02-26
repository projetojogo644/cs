# Antigravity CS - Arena tactical Shooter

Um shooter tático 3D desenvolvido com Three.js focado em alto desempenho no navegador e mecânicas de baixa gravidade.

## 🚀 Como Jogar

1.  Abra o arquivo `index.html` em qualquer navegador (Recomendado usar o Live Server ou abrir após o deploy).
2.  Clique em **"ENTRAR NA ARENA"**.
3.  **Controles**:
    *   `WASD`: Movimentação básica.
    *   `ESPAÇO`: Salto de Antigravidade (Salto alto).
    *   `MOUSE`: Olhar ao redor.
    *   `BOTÃO ESQUERDO`: Atirar.
    *   `1, 2, 3`: Trocar arsenal (Pistola, SMG, Sniper).

## 🛠️ Workflow de Desenvolvimento (GitHub Desktop)

Para manter o projeto organizado seguindo as diretrizes:

1.  **Commits**: Use o padrão:
    *   `feat: add gun switching logic`
    *   `fix: jump collision floor`
    *   `style: add neon bloom effects`

2.  **Deploy no GitHub Pages**:
    *   Faça o **Push** de todos os arquivos (`index.html`, `main.js`, `style.css`, `.gitignore`) para a branch `main`.
    *   No seu repositório no GitHub.com:
        *   Vá em **Settings** > **Pages**.
        *   Em **Branch**, selecione `main` e a pasta `/root`.
        *   Clique em **Save**.
    *   O link do jogo estará disponível em poucos minutos.

## 🎨 Características Técnicas

*   **Engine**: Three.js (via CDN - zero instalação necessária).
*   **Design**: Estética Cyberpunk/Tactical com Glassmorphism.
*   **Performance**: Modelos Low-poly baseados em geometrias nativas para máximo FPS.
*   **Antigravidade**: Constante gravitacional reduzida para permitir combate vertical.
