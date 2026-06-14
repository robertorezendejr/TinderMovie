# 📃 SOP (Standard Operating Procedure) - TMDB Client

## 🎯 Objetivo
Definir como a aplicação client-side consome, filtra, pagina e adapta os dados de filmes a partir da API oficial do TMDB.

---

## 📥 Inputs
- Credenciais configuradas na aplicação (Bearer Token).
- Filtros ativos do usuário (`FilterSettings`):
  - Gêneros (`genres: number[]`)
  - Anos de lançamento (`minReleaseYear`, `maxReleaseYear`)
  - Nota mínima (`minVoteAverage: number`)
  - Duração máxima (`maxRuntime: number | null`)
  - Provedores de streaming (`providers: number[]`)

---

## 🛠️ Lógica de Funcionamento e Endpoints

### 1. Inicialização e Configuração
O cliente TMDB no frontend usará a API Fetch com cabeçalhos HTTP de autorização:
```javascript
const headers = {
  "Authorization": `Bearer ${TMDB_BEARER_TOKEN}`,
  "accept": "application/json"
};
```

### 2. Fluxo de Busca de Filmes (`/discover/movie`)
Para preencher o deck de cartas, a aplicação fará requisições assíncronas ao endpoint de descoberta:
`GET https://api.themoviedb.org/3/discover/movie`

**Parâmetros de Query Obrigatórios**:
- `language=pt-BR`: Para retornar títulos, sinopses e gêneros em português do Brasil.
- `watch_region=BR`: Região do Brasil para filtragem de provedores de streaming.
- `sort_by=popularity.desc`: Ordenar por popularidade para exibir primeiro filmes relevantes do grande público.
- `page={numero_pagina}`: Controle de paginação (começando em 1). Armazenar o número da página atual na sessão.
- `vote_average.gte={FilterSettings.minVoteAverage}`: Filtragem de qualidade mínima.

**Parâmetros Condicionais (Filtros)**:
- Se `FilterSettings.genres` possuir itens: `with_genres={genres.join(',')}` (filtro lógico OR) ou `with_genres={genres.join('&')}` (filtro lógico AND). Para melhor experiência de catálogo do MVP, usaremos separador por vírgula (OR) para garantir maior diversidade de cartas.
- Se `FilterSettings.minReleaseYear` estiver definido: `primary_release_date.gte={minReleaseYear}-01-01`.
- Se `FilterSettings.maxReleaseYear` estiver definido: `primary_release_date.lte={maxReleaseYear}-12-31`.
- Se `FilterSettings.providers` possuir itens: `with_watch_providers={providers.join('|')}` (filtro lógico OR).

### 3. Busca de Detalhes Adicionais (Duração e Trailer)
O endpoint de descoberta do TMDB não retorna a duração do filme (`runtime`) nem os vídeos associados. Portanto, após buscar o lote de filmes via discover, faremos chamadas concorrentes controladas (para evitar bloqueios ou concorrência excessiva) para cada filme retornado a fim de obter esses dados extras:
`GET https://api.themoviedb.org/3/movie/{movie_id}?append_to_response=videos,watch/providers`

Dessa resposta, extrairemos:
- **Duração**: `runtime` (em minutos).
- **Trailer**: Procurar em `videos.results` o primeiro item com `site == "YouTube"` e `type == "Trailer"`. Obter a chave (`key`) para gerar a URL incorporável: `https://www.youtube.com/embed/{key}`.
- **Provedores de Streaming**: Acessar o nó `watch/providers.results.BR.flatrate` para obter a lista de provedores por assinatura no Brasil (extrair `provider_id`, `provider_name` e `logo_path`).

---

## 🔄 Adaptação de Dados (Data Mapper)

Nenhum dado bruto da API do TMDB deve ser injetado diretamente no DOM. O cliente deverá mapear o resultado para a estrutura `Movie` e depois para o formato final de renderização `MovieCard`:

```javascript
function mapToMovieCard(movieData, detailsData) {
  const releaseYear = detailsData.release_date ? new Date(detailsData.release_date).getFullYear() : null;
  
  // Mapear provedores de streaming
  const providers = (detailsData["watch/providers"]?.results?.BR?.flatrate || []).map(p => ({
    id: p.provider_id,
    name: p.provider_name,
    logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
    displayPriority: p.display_priority
  }));

  // Extrair trailer
  const trailerKey = (detailsData.videos?.results || []).find(v => v.site === "YouTube" && v.type === "Trailer")?.key;
  const trailerUrl = trailerKey ? `https://www.youtube.com/embed/${trailerKey}` : null;

  // Retorna o MovieCard otimizado para a UI
  return {
    id: detailsData.id,
    title: detailsData.title,
    overviewSummary: detailsData.overview ? truncateText(detailsData.overview, 180) : "",
    posterUrl: detailsData.poster_path ? `https://image.tmdb.org/t/p/w500${detailsData.poster_path}` : "",
    releaseYear: releaseYear,
    voteAverage: detailsData.vote_average,
    genres: detailsData.genres.map(g => g.name),
    runtimeText: detailsData.runtime ? formatRuntime(detailsData.runtime) : "N/A",
    trailerUrl: trailerUrl,
    providersLogos: providers.map(p => p.logoUrl)
  };
}
```

---

## ⚠️ Edge Cases & Tratamento de Erros
1. **Dados Incompletos**: Filmes que não possuírem título (`title`), pôster (`poster_path`) ou sinopse (`overview`) serão ignorados e descartados silenciosamente antes de serem adicionados ao deck.
2. **Trailer Ausente**: Se não houver trailer oficial no YouTube, o atributo `trailerUrl` será definido como `null` e a UI deverá ocultar o botão de trailer correspondente de forma elegante.
3. **Sem Provedores de Streaming**: Caso o filme não esteja disponível por assinatura em nenhum provedor no Brasil (lista `flatrate` vazia), exibir um selo com a informação "Apenas Compra/Aluguel ou não disponível no momento".
4. **Token Inválido ou Erro HTTP**: Se o TMDB retornar status `401` ou `403` (Token inválido/expirado) ou houver falha de conexão física, exibir um modal de erro amigável na tela e pausar requisições até a redefinição de credenciais ou reconexão.
5. **Duração Zero/Indefinida**: Se a API do TMDB retornar `runtime: 0` ou `null`, exibir "Duração indisponível".
