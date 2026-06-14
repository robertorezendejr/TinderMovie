# 📃 SOP (Standard Operating Procedure) - Motor de Recomendação Simples

## 🎯 Objetivo
Definir o algoritmo de ordenação de cartas no lado do cliente (client-side) para priorizar filmes que combinem com os gêneros mais curtidos pelo usuário, reduzindo o tempo de escolha.

---

## 📥 Inputs
- A lista de filmes brutos ou mapeados recém-baixados da API do TMDB.
- O histórico de filmes curtidos pelo usuário (armazenado no `LocalStorage`).
- O perfil de recomendação ativo do usuário (`RecommendationProfile`).

---

## 🛠️ Lógica de Recomendação (Frequência de Gêneros)

Como esta versão do TinderMovie não utilizará processamento pesado no servidor nem inteligência artificial/LLMs, o motor de recomendação operará com um algoritmo estatístico simples no cliente.

### 1. Estrutura do Perfil de Recomendação (`RecommendationProfile`)
Toda vez que o usuário dá um "Like" em um filme, o sistema atualiza o perfil de preferências:
- **`likedGenresFrequency`**: Um dicionário de mapeamento `{ ID_DO_GENERO: QUANTIDADE_DE_LIKES }`.
- **`averageVoteOfLiked`**: Média flutuante da nota média TMDB dos filmes curtidos.
- **`preferredYears`**: Lista de anos dos filmes curtidos (para identificar se o usuário prefere clássicos ou lançamentos).

```javascript
function updateRecommendationProfile(newLikedMovie) {
  const profile = JSON.parse(localStorage.getItem('recommendationProfile')) || {
    likedGenresFrequency: {},
    averageVoteOfLiked: 0,
    preferredYears: [],
    totalLikes: 0
  };

  // 1. Atualizar frequência de gêneros
  newLikedMovie.genreIds.forEach(genreId => {
    profile.likedGenresFrequency[genreId] = (profile.likedGenresFrequency[genreId] || 0) + 1;
  });

  // 2. Atualizar nota média
  profile.totalLikes += 1;
  profile.averageVoteOfLiked = ((profile.averageVoteOfLiked * (profile.totalLikes - 1)) + newLikedMovie.voteAverage) / profile.totalLikes;

  // 3. Registrar anos preferidos
  if (newLikedMovie.releaseYear) {
    profile.preferredYears.push(newLikedMovie.releaseYear);
  }

  localStorage.setItem('recommendationProfile', JSON.stringify(profile));
}
```

### 2. Algoritmo de Ranqueamento de Filmes no Deck
Sempre que uma nova lista de filmes for retornada da API do TMDB (por exemplo, 20 filmes), antes de mapeá-la para `MovieCard` e empilhá-la no deck, os filmes devem passar pelo algoritmo de pontuação e ordenação:

1. **Recuperar o Perfil de Recomendação** do LocalStorage. Se o perfil for novo ou o usuário tiver 0 curtidas, a pontuação de todos os filmes será equivalente (mantendo a ordenação original por popularidade do TMDB).
2. **Cálculo da Pontuação de Recomendação (Score)** de cada filme:
   Para cada filme da lista:
   - Inicializar a pontuação: `Score = 0`.
   - **Pontuação de Gêneros (Peso Principal)**:
     - Para cada gênero que o filme possui (`genreId`), verificar a frequência de curtidas no perfil.
     - Somar a frequência à pontuação do filme. Por exemplo: se o filme é de *Ação* (gênero que o usuário curtiu 5 vezes) e *Aventura* (gênero curtiu 3 vezes), o score inicial do filme será `5 + 3 = 8`.
   - **Fator de Afinidade de Nota (Peso Secundário)**:
     - Se o filme tiver nota TMDB superior ou igual à `averageVoteOfLiked`, adicionar um bônus leve de `+1` ao score.
   - **Fator de Afinidade de Ano (Peso Terciário)**:
     - Se o ano de lançamento do filme estiver dentro do desvio padrão ou da faixa dos anos mais curtidos em `preferredYears` (por exemplo, diferença absoluta menor que 5 anos em relação à média dos anos curtidos), adicionar um bônus leve de `+0.5` ao score.
3. **Ordenação**:
   - Ordenar a lista de filmes em ordem decrescente de `Score`.
   - Se houver empate no score de dois ou mais filmes, usar a popularidade padrão retornada pelo TMDB como critério de desempate.
4. **Inserção**:
   - Adicionar os filmes ordenados ao final da pilha atual do deck.

---

## ⚠️ Edge Cases & Considerações de Escalabilidade
1. **Cold Start (Sem Histórico)**: Quando o usuário abrir o aplicativo pela primeira vez (ou após limpar dados), o perfil de recomendação estará vazio. O sistema deve simplesmente exibir os filmes na ordem de popularidade padrão do TMDB.
2. **Polarização Extrema**: Se o usuário curtiu apenas um gênero (ex: Terror), o motor irá sobrecarregar o deck com Terror. Para mitigar isso e manter a descoberta divertida (Tinder de filmes), o sistema deve misturar à pilha pelo menos 20% de filmes populares aleatórios (que não necessariamente batem com o gênero dominante do usuário). Isso é feito limitando o bônus de gêneros ou garantindo que o discover do TMDB sempre traga gêneros variados.
3. **Redefinição do Perfil**: A tela de filtros deve conter uma opção clara para "Redefinir Preferências de Recomendação", o que simplesmente limpa as frequências e médias no LocalStorage, permitindo ao usuário recomeçar o algoritmo do zero.
4. **Normalização de Frequências**: Conforme o histórico cresce (ex: 200 likes), as frequências podem ficar muito altas e causar distorções. Periodicamente ou após 100 likes, o sistema pode aplicar uma normalização (dividindo os valores de frequência pelo total de likes) para manter as pontuações em intervalos previsíveis.
