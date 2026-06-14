# 📃 SOP (Standard Operating Procedure) - Deck State & Swipes

## 🎯 Objetivo
Definir o fluxo de estados do deck de filmes, a detecção física dos gestos de swipe, a ordenação visual das cartas e a persistência imediata no armazenamento do navegador.

---

## 📥 Inputs
- Um array de objetos do tipo `MovieCard` fornecidos pelo motor de recomendação.
- Eventos de input do usuário:
  - Interações por mouse (clicar, arrastar, soltar) no Desktop.
  - Interações por toque (touchstart, touchmove, touchend) no Mobile.
  - Cliques em botões físicos na UI ("Gostei" / "Não Gostei").

---

## 🛠️ Lógica de Gerenciamento do Deck

### 1. Pilha de Cartas no DOM (Z-Index Stack)
- A pilha de cartas é representada no DOM por uma lista ordenada.
- Apenas as duas ou três cartas do topo devem ser efetivamente renderizadas e preparadas no DOM para manter o desempenho de renderização alto (evitando excesso de nós DOM de imagens pesadas).
- A carta do topo possui o maior `z-index` e é a única com a qual o usuário pode interagir (arrastar). A carta de baixo (segundo lugar) fica estática ou levemente reduzida em escala (ex: `transform: scale(0.95)`) criando o efeito visual de profundidade.

### 2. Ciclo de Vida do Swipe
1. **Início do Arrasto (`touchstart`/`mousedown`)**:
   - Registrar as coordenadas iniciais (`startX`, `startY`).
   - Adicionar uma classe CSS temporária na carta ativa (ex: `.is-dragging`) para remover transições de CSS enquanto arrasta, permitindo resposta imediata ao movimento.
2. **Durante o Arrasto (`touchmove`/`mousemove`)**:
   - Calcular a variação (`deltaX = currentX - startX` e `deltaY = currentY - startY`).
   - Atualizar a posição do card via transformações CSS:
     ```css
     transform: translate(deltaX px, deltaY px) rotate(deltaX * 0.1 deg);
     ```
   - Exibir dinamicamente overlays visuais graduais sobre a carta:
     - Se `deltaX > 0`: Opacidade progressiva de um indicador verde ("LIKE" / "QUERO ASSISTIR").
     - Se `deltaX < 0`: Opacidade progressiva de um indicador vermelho ("DISLIKE" / "NÃO GOSTEI").
3. **Fim do Arrasto (`touchend`/`mouseup`)**:
   - Remover a classe `.is-dragging`.
   - Calcular se o deslocamento horizontal absoluto superou o limiar mínimo (threshold) de **120 pixels**.
   - **Caso passe do Threshold**:
     - Disparar a ação correspondente: `like` se `deltaX > 0`, ou `dislike` se `deltaX < 0`.
     - Animar a carta para voar para fora da tela (ex: translação de `1000px` em direção ao swipe).
     - Acionar a persistência imediata e remover o elemento do DOM após a animação de saída.
     - Promover a carta seguinte ao topo da pilha e redefinir sua escala para 1.0 com animação suave.
   - **Caso não passe do Threshold**:
     - Resetar a carta para a posição inicial com uma transição suave CSS (`transform: translate(0, 0) rotate(0)`).

### 3. Persistência de Dados e Atualização de Estado
Imediatamente após a conclusão de um swipe (seja via gesto ou clique de botão):
1. **Adicionar o ID** do filme correspondente à lista `likedIds` ou `dislikedIds` dentro da chave `watchlist` no `LocalStorage`.
2. **Adicionar a ação** `SwipeAction` no array `history` da `watchlist` (para posterior análise temporal ou auditoria).
3. **Atualizar o Perfil de Recomendação** no `LocalStorage` chamando a lógica de recalculo de peso de gêneros.

```javascript
function persistSwipe(movieId, actionType) {
  const watchlist = JSON.parse(localStorage.getItem('watchlist')) || { likedIds: [], dislikedIds: [], history: [] };
  
  if (actionType === 'like') {
    watchlist.likedIds.push(movieId);
  } else {
    watchlist.dislikedIds.push(movieId);
  }
  
  watchlist.history.push({
    movieId: movieId,
    action: actionType,
    timestamp: Date.now()
  });

  localStorage.setItem('watchlist', JSON.stringify(watchlist));
}
```

### 4. Mecanismo de Pre-fetching (Carregamento Antecipado)
- O estado do deck monitora ativamente o comprimento da fila de cards local.
- **Trigger**: Sempre que a quantidade de cartas restantes no deck for **menor ou igual a 3**, o deck acionará silenciosamente a busca assíncrona do TMDB (conforme `SOP_TMDB_client.md`) para obter a próxima página do catálogo.
- **Filtro Preventivo**: Antes de inserir os novos cards obtidos na fila de exibição, a aplicação deve confrontá-los com a `watchlist` (`likedIds` e `dislikedIds`). Qualquer filme já interagido deve ser ignorado.

---

## ⚠️ Edge Cases
1. **Deck Totalmente Vazio**: Se a busca no TMDB não retornar mais filmes que passem nos filtros e que já não tenham recebido swipe:
   - Limpar o container de cartas.
   - Renderizar um estado de "Fim da Pilha" visualmente atraente (ilustração simples, mensagem amigável e um botão de ação proeminente "Redefinir Filtros" ou "Limpar Histórico").
2. **Multitoque / Cliques Rápidos**: Desabilitar novos gestos ou cliques de botão enquanto a animação de transição da carta saindo do deck não tiver sido concluída (debounce de transição).
3. **Arrastos Verticais Acidentais**: Se o movimento for predominantemente vertical (`Math.abs(deltaY) > Math.abs(deltaX)` e o arrasto horizontal for menor que `30px`), permitir o scroll padrão do navegador ou não realizar swipe de descarte.
