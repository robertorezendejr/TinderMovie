/**
 * TinderMovie - Core JavaScript Logic
 * Arquitetura A.N.T. - Layer 2: Navigation & Core App
 */

// ==========================================================================
// Autenticação Supabase
// ==========================================================================

let currentUser = null;

async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return false;
  }
  currentUser = session.user;
  return true;
}

async function loadUserWatchlistFromSupabase() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("user_watchlists")
    .select("movie_id, action")
    .eq("user_id", currentUser.id);

  if (error) {
    console.warn("Erro ao carregar watchlist do Supabase:", error.message);
    return;
  }

  if (data && data.length > 0) {
    data.forEach(row => {
      if (row.action === "like" && !state.watchlist.likedIds.includes(row.movie_id)) {
        state.watchlist.likedIds.push(row.movie_id);
      } else if (row.action === "dislike" && !state.watchlist.dislikedIds.includes(row.movie_id)) {
        state.watchlist.dislikedIds.push(row.movie_id);
      }
    });
    localStorage.setItem("watchlist", JSON.stringify(state.watchlist));
  }
}

async function saveSwipeToSupabase(movieId, action) {
  if (!currentUser) return;

  await supabaseClient
    .from("user_watchlists")
    .upsert(
      { user_id: currentUser.id, movie_id: movieId, action },
      { onConflict: "user_id,movie_id" }
    );
}

async function clearWatchlistInSupabase() {
  if (!currentUser) return;

  await supabaseClient
    .from("user_watchlists")
    .delete()
    .eq("user_id", currentUser.id)
    .eq("action", "like");
}

async function clearAllHistoryInSupabase() {
  if (!currentUser) return;

  await supabaseClient
    .from("user_watchlists")
    .delete()
    .eq("user_id", currentUser.id);
}

// ==========================================================================
// Estado Global da Aplicação
// ==========================================================================
const state = {
  // Credenciais
  tmdbBearerToken: "",
  tmdbApiKey: "",

  // Dados do Catálogo
  moviesPool: [],       // Lista de filmes carregados prontos para serem transformados em cards
  deckQueue: [],        // Fila de objetos MovieCard a serem renderizados no deck
  currentPage: 1,       // Página de busca atual do TMDB Discover
  isLoading: false,     // Flag de controle para buscas concorrentes

  // Estado da Watchlist e Histórico
  watchlist: {
    likedIds: [],
    dislikedIds: [],
    history: []
  },

  // Perfil de Recomendação
  recommendationProfile: {
    likedGenresFrequency: {},
    averageVoteOfLiked: 0,
    preferredYears: [],
    totalLikes: 0
  },

  // Configurações de Filtros Atuais
  filters: {
    genres: [],
    minReleaseYear: null,
    maxReleaseYear: null,
    minVoteAverage: 6.0,
    maxRuntime: 180,
    providers: [] // IDs dos provedores de streaming
  },

  // Estado Físico do Deck (Swipes)
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  activeCardElement: null,

  // Lista de Gêneros e Provedores Estáticos para Fallback/Mapeamento
  genresMap: {}, // ID -> Nome
  defaultProviders: [
    { id: 8, name: "Netflix", logoPath: "/p136JWrIOEsKyQz862hLJZYY4n5.jpg" },
    { id: 119, name: "Prime Video", logoPath: "/dQe2652mC4Ns2q2GtGgPtY7PIw5.jpg" },
    { id: 337, name: "Disney+", logoPath: "/97EvGTLmHw7c460n04R70Hgggo3.jpg" },
    { id: 1899, name: "Max", logoPath: "/or4m10Vd86C9Wf1cZ70Lh8vJ2bK.jpg" },
    { id: 350, name: "Apple TV+", logoPath: "/6jBC9wz4Qc59579040R470Hgggo3.jpg" },
    { id: 307, name: "Globoplay", logoPath: "/97EvGTLmHw7c460n04R70Hgggo3.jpg" } // Mapeados dinamicamente depois
  ]
};

// Limiar para ativação do Swipe (em pixels)
const SWIPE_THRESHOLD = 120;

// ==========================================================================
// Inicialização do App
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  const authed = await checkAuth();
  if (!authed) return;

  setupEventListeners();
  loadStateFromLocalStorage();
  await loadUserWatchlistFromSupabase();
  updateWatchlistBadge();
  await loadCredentials();
});

/**
 * Carrega o histórico de swipes, preferências e perfil de recomendação do LocalStorage.
 */
function loadStateFromLocalStorage() {
  const storedWatchlist = localStorage.getItem("watchlist");
  if (storedWatchlist) {
    state.watchlist = JSON.parse(storedWatchlist);
  }

  const storedProfile = localStorage.getItem("recommendationProfile");
  if (storedProfile) {
    state.recommendationProfile = JSON.parse(storedProfile);
  }

  const storedFilters = localStorage.getItem("filterSettings");
  if (storedFilters) {
    state.filters = JSON.parse(storedFilters);
    syncFilterUI();
  }
}

/**
 * Tenta obter as credenciais da API do TMDB
 * Ordem de prioridade:
 * 1. config.js (credenciais embutidas para todos os usuários)
 * 2. LocalStorage (configurado manualmente pelo usuário na UI)
 */
async function loadCredentials() {
  // 1. Credenciais embutidas no config.js (prioridade máxima)
  if (window.TMDB_CONFIG && (window.TMDB_CONFIG.bearerToken || window.TMDB_CONFIG.apiKey)) {
    state.tmdbBearerToken = window.TMDB_CONFIG.bearerToken || "";
    state.tmdbApiKey = window.TMDB_CONFIG.apiKey || "";
    initializeAppFlow();
    return;
  }

  // 2. Tentar LocalStorage (fallback para configuração manual anterior)
  const localBearer = localStorage.getItem("tmdb_bearer_token");
  const localKey = localStorage.getItem("tmdb_api_key");

  if (localBearer || localKey) {
    state.tmdbBearerToken = localBearer || "";
    state.tmdbApiKey = localKey || "";
    initializeAppFlow();
    return;
  }

  // Se nada deu certo, exibe o modal de configuração de chave
  showModal("api-modal");
}

/**
 * Parser simples de chaves em formato KEY=VALUE
 */
function parseEnv(envText) {
  const vars = {};
  const lines = envText.split("\n");
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.includes("=")) {
      const parts = line.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      vars[key] = val;
    }
  }
  return vars;
}

/**
 * Inicializa o fluxo do aplicativo após ter credenciais válidas
 */
async function initializeAppFlow() {
  hideModal("api-modal");
  showLoading(true);
  
  try {
    // Carregar configurações de catálogo do TMDB
    await fetchGenresList();
    await fetchProvidersList();
    
    // Iniciar a busca da primeira pilha de filmes
    await fetchNextBatchOfMovies();
  } catch (error) {
    console.error("Falha ao inicializar o app com o TMDB:", error);
    alert("Erro na conexão com o TMDB. Por favor, verifique sua chave API.");
    showModal("api-modal");
  } finally {
    showLoading(false);
  }
}

// ==========================================================================
// Integração e Requisições da API TMDB (SOP_TMDB_client)
// ==========================================================================

/**
 * Retorna os headers de autorização apropriados
 */
function getHeaders() {
  const headers = {
    "accept": "application/json"
  };
  if (state.tmdbBearerToken) {
    headers["Authorization"] = `Bearer ${state.tmdbBearerToken}`;
  }
  return headers;
}

/**
 * Faz requisições HTTP para a API TMDB lidando com API Key v3 ou Bearer v4
 */
async function tmdbFetch(endpoint, queryParams = {}) {
  let url = `https://api.themoviedb.org/3${endpoint}`;
  
  // Se não estiver usando Bearer Token e tiver API Key tradicional, anexa à query string
  if (!state.tmdbBearerToken && state.tmdbApiKey) {
    queryParams["api_key"] = state.tmdbApiKey;
  }

  const queryString = Object.keys(queryParams)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join("&");

  if (queryString) {
    url += `?${queryString}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders()
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("tmdb_bearer_token");
      localStorage.removeItem("tmdb_api_key");
      showModal("api-modal");
      throw new Error("Credenciais inválidas do TMDB.");
    }
    throw new Error(`Erro de requisição TMDB: Código HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Busca a lista oficial de gêneros do TMDB em português
 */
async function fetchGenresList() {
  const data = await tmdbFetch("/genre/movie/list", { language: "pt-BR" });
  if (data && data.genres) {
    data.genres.forEach(g => {
      state.genresMap[g.id] = g.name;
    });
    renderGenresFilters(data.genres);
  }
}

/**
 * Busca os provedores de streaming populares no BR
 */
async function fetchProvidersList() {
  try {
    const data = await tmdbFetch("/watch/providers/movie", {
      language: "pt-BR",
      watch_region: "BR"
    });
    
    if (data && data.results) {
      // Filtrar apenas pelos provedores mais comuns do Brasil para não sobrecarregar a UI de filtros
      // IDs: Netflix (8), Prime Video (119), Disney+ (337), Max (1899), Apple TV (350), Globoplay (307), Star+ (1914)
      const primaryIds = [8, 119, 337, 1899, 350, 307];
      const filtered = data.results
        .filter(p => primaryIds.includes(p.provider_id))
        .map(p => ({
          id: p.provider_id,
          name: p.provider_name,
          logoPath: p.logo_path
        }));

      renderProvidersFilters(filtered);
    }
  } catch (err) {
    console.warn("Não foi possível carregar os provedores dinamicamente. Usando fallbacks estáticos.");
    renderProvidersFilters(state.defaultProviders.map(p => ({
      id: p.id,
      name: p.name,
      logoPath: p.logoPath
    })));
  }
}

/**
 * Busca o lote principal de filmes populares que satisfazem os filtros
 */
async function fetchNextBatchOfMovies() {
  if (state.isLoading) return;
  state.isLoading = true;

  try {
    const queryParams = {
      language: "pt-BR",
      watch_region: "BR",
      sort_by: "popularity.desc",
      page: state.currentPage,
      "vote_average.gte": state.filters.minVoteAverage
    };

    // Aplicar filtro de gênero
    if (state.filters.genres.length > 0) {
      queryParams["with_genres"] = state.filters.genres.join(",");
    }

    // Aplicar ano de lançamento
    if (state.filters.minReleaseYear) {
      queryParams["primary_release_date.gte"] = `${state.filters.minReleaseYear}-01-01`;
    }
    if (state.filters.maxReleaseYear) {
      queryParams["primary_release_date.lte"] = `${state.filters.maxReleaseYear}-12-31`;
    }

    // Aplicar filtro de provedores de streaming
    if (state.filters.providers.length > 0) {
      queryParams["with_watch_providers"] = state.filters.providers.join("|");
    }

    const discoverData = await tmdbFetch("/discover/movie", queryParams);
    
    if (discoverData && discoverData.results && discoverData.results.length > 0) {
      // Filtrar filmes já interagidos no LocalStorage (likedIds e dislikedIds)
      const filteredResults = discoverData.results.filter(movie => {
        return !state.watchlist.likedIds.includes(movie.id) && 
               !state.watchlist.dislikedIds.includes(movie.id);
      });

      // Se após a filtragem de repetidos não sobrar filmes, pular de página e buscar novamente
      if (filteredResults.length === 0 && discoverData.page < discoverData.total_pages) {
        state.currentPage += 1;
        state.isLoading = false;
        return await fetchNextBatchOfMovies();
      }

      // Buscar detalhes adicionais concorrentemente (duração, streaming e vídeos)
      const detailsPromises = filteredResults.map(movie => 
        fetchMovieDetails(movie.id).catch(() => null) // Garante que se uma falhar, as outras continuem
      );
      
      const detailedMovies = await Promise.all(detailsPromises);
      
      // Adaptar dados brutos recebidos
      const validMovies = [];
      detailedMovies.forEach(details => {
        if (details && validateMovieData(details)) {
          validMovies.push(adaptToMovieCard(details));
        }
      });

      if (validMovies.length > 0) {
        // Enviar os novos cards para o motor de recomendação/ranqueador
        const rankedCards = rankMovieCards(validMovies);
        
        // Colocar na fila do deck
        state.deckQueue.push(...rankedCards);
        renderDeck();
        
        // Incrementar página para a próxima busca
        state.currentPage += 1;
      } else if (discoverData.page < discoverData.total_pages) {
        state.currentPage += 1;
        state.isLoading = false;
        return await fetchNextBatchOfMovies();
      }
    } else {
      // Se não há resultados de forma alguma, exibe o estado vazio se o deck estiver zerado
      if (state.deckQueue.length === 0) {
        showEmptyState(true);
      }
    }
  } catch (error) {
    console.error("Erro ao buscar filmes do TMDB:", error);
  } finally {
    state.isLoading = false;
  }
}

/**
 * Busca detalhes, vídeos/trailers e watch providers do filme
 */
async function fetchMovieDetails(movieId) {
  return await tmdbFetch(`/movie/${movieId}`, {
    language: "pt-BR",
    append_to_response: "videos,watch/providers"
  });
}

/**
 * Validação de dados de acordo com a Behavioral Rule 2:
 * Não permitir cards com título, pôster ou overview ausentes.
 */
function validateMovieData(details) {
  return details.title && details.poster_path && details.overview;
}

/**
 * Adaptador de Dados (Data-First Rule)
 * Transforma dados do TMDB na estrutura otimizada do MovieCard
 */
function adaptToMovieCard(details) {
  const releaseYear = details.release_date ? new Date(details.release_date).getFullYear() : null;
  
  // Extrair provedores do BR por assinatura (flatrate)
  const providers = (details["watch/providers"]?.results?.BR?.flatrate || []).map(p => ({
    id: p.provider_id,
    name: p.provider_name,
    logoUrl: `https://image.tmdb.org/t/p/w92${p.logo_path}`,
    displayPriority: p.display_priority
  }));

  // Extrair trailer do YouTube
  const youtubeTrailer = (details.videos?.results || []).find(
    v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  );
  const trailerUrl = youtubeTrailer ? `https://www.youtube.com/embed/${youtubeTrailer.key}` : null;

  // Formatar tempo de duração
  let runtimeText = "N/A";
  if (details.runtime) {
    const hours = Math.floor(details.runtime / 60);
    const mins = details.runtime % 60;
    runtimeText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  return {
    id: details.id,
    title: details.title,
    overviewSummary: details.overview,
    posterUrl: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
    releaseYear: releaseYear,
    voteAverage: details.vote_average,
    genres: details.genres ? details.genres.map(g => g.name) : [],
    genreIds: details.genres ? details.genres.map(g => g.id) : [],
    runtimeText: runtimeText,
    runtimeMinutes: details.runtime || 0,
    trailerUrl: trailerUrl,
    providersLogos: providers.map(p => p.logoUrl)
  };
}

// ==========================================================================
// Motor de Recomendação (SOP_recommendation)
// ==========================================================================

/**
 * Ranqueia os filmes novos com base na preferência estatística do usuário
 */
function rankMovieCards(movieCards) {
  const profile = state.recommendationProfile;
  
  // Se não temos total de likes ainda, mantém ordenação original por popularidade
  if (!profile.totalLikes || profile.totalLikes === 0) {
    return movieCards;
  }

  // Pontuar cada filme individualmente
  return movieCards.map(movie => {
    let score = 0;
    
    // 1. Pontuação por gênero (Peso Principal)
    movie.genreIds.forEach(id => {
      const frequency = profile.likedGenresFrequency[id] || 0;
      score += frequency; // Ganha peso cumulativo dependendo de quantos likes o gênero recebeu
    });

    // 2. Pontuação por Nota Média (Bônus Secundário)
    if (movie.voteAverage >= profile.averageVoteOfLiked) {
      score += 1.5;
    }

    // 3. Afinidade por ano (Bônus Terciário)
    if (profile.preferredYears && profile.preferredYears.length > 0) {
      // Calcular média de anos
      const avgYear = profile.preferredYears.reduce((a, b) => a + b, 0) / profile.preferredYears.length;
      if (Math.abs(movie.releaseYear - avgYear) <= 5) {
        score += 0.5; // Bônus de proximidade de era de filmes
      }
    }

    // Guardar score temporário para ordenação
    movie._tempScore = score;
    return movie;
  })
  .sort((a, b) => b._tempScore - a._tempScore) // Ordenar decrescente por recomendação
  .map(movie => {
    delete movie._tempScore;
    return movie;
  });
}

/**
 * Atualiza o perfil de recomendação no LocalStorage baseado no filme que recebeu Like
 */
function updateRecommendationProfile(likedMovie) {
  const profile = state.recommendationProfile;

  // 1. Incrementar frequência de gêneros
  likedMovie.genreIds.forEach(id => {
    profile.likedGenresFrequency[id] = (profile.likedGenresFrequency[id] || 0) + 1;
  });

  // 2. Recalcular nota média
  profile.totalLikes = (profile.totalLikes || 0) + 1;
  const currentTotal = profile.totalLikes;
  profile.averageVoteOfLiked = ((profile.averageVoteOfLiked * (currentTotal - 1)) + likedMovie.voteAverage) / currentTotal;

  // 3. Adicionar ano
  if (likedMovie.releaseYear) {
    profile.preferredYears.push(likedMovie.releaseYear);
  }

  // Persistir perfil atualizado
  localStorage.setItem("recommendationProfile", JSON.stringify(profile));
  state.recommendationProfile = profile;
}

// ==========================================================================
// Gerenciamento e Interações do Deck (SOP_deck_state)
// ==========================================================================

/**
 * Renderiza o deck de cartas no DOM
 */
function renderDeck() {
  const container = document.getElementById("deck-container");
  
  // Limpar cards antigos
  const oldCards = container.querySelectorAll(".movie-card");
  oldCards.forEach(c => c.remove());

  showLoading(false);

  if (state.deckQueue.length === 0) {
    showEmptyState(true);
    return;
  }

  showEmptyState(false);

  // Renderizar as 3 primeiras cartas do topo da fila para performance visual
  const cardsToRender = state.deckQueue.slice(0, 3);
  
  cardsToRender.forEach((movie, index) => {
    const cardEl = document.createElement("div");
    cardEl.className = "movie-card";
    cardEl.dataset.id = movie.id;
    cardEl.style.zIndex = 100 - index; // Maior z-index para a primeira carta (topo)
    
    // Efeito de profundidade/escala para as cartas de baixo
    if (index > 0) {
      const scale = 1 - (index * 0.04);
      const translateY = index * 10;
      cardEl.style.transform = `scale(${scale}) translateY(${translateY}px)`;
      cardEl.style.opacity = 1 - (index * 0.2);
    }

    // Estrutura interna da carta
    cardEl.innerHTML = `
      <img class="card-poster" src="${movie.posterUrl}" alt="${movie.title}" draggable="false">
      <div class="card-gradient"></div>
      
      <!-- Overlays de Like/Dislike -->
      <div class="card-overlay like">GOSTEI</div>
      <div class="card-overlay dislike">NOPE</div>

      <div class="card-details">
        <div class="card-meta-top">
          <div class="card-rating">
            <i class="fa-solid fa-star"></i>
            <span>${movie.voteAverage.toFixed(1)}</span>
          </div>
          ${movie.runtimeText !== "N/A" ? `<span class="card-rating">${movie.runtimeText}</span>` : ""}
        </div>
        <h2 class="card-title">${movie.title}</h2>
        <div class="card-meta-sub">
          <span class="meta-item">${movie.releaseYear || "N/A"}</span>
          <div class="card-genres">
            ${movie.genres.slice(0, 3).map(g => `<span class="genre-tag">${g}</span>`).join("")}
          </div>
        </div>
        <p class="card-overview">${movie.overviewSummary}</p>
        
        ${movie.providersLogos.length > 0 ? `
          <div class="card-providers">
            <span>Disponível em:</span>
            ${movie.providersLogos.slice(0, 4).map(logo => `<img class="provider-mini-logo" src="${logo}">`).join("")}
          </div>
        ` : ""}
      </div>
    `;

    container.appendChild(cardEl);
    
    // Registrar a primeira carta como a ativa
    if (index === 0) {
      state.activeCardElement = cardEl;
      setupCardDrag(cardEl);
    }
  });
}

/**
 * Trata os eventos físicos de arrastar no card (Desktop e Mobile)
 */
function setupCardDrag(card) {
  // Mobile touch event listeners
  card.addEventListener("touchstart", onDragStart, { passive: true });
  card.addEventListener("touchmove", onDragMove, { passive: true });
  card.addEventListener("touchend", onDragEnd);

  // Desktop mouse event listeners
  card.addEventListener("mousedown", onDragStart);
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);
}

function onDragStart(e) {
  if (e.type === "mousedown") {
    state.isDragging = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
  } else {
    state.isDragging = true;
    state.startX = e.touches[0].clientX;
    state.startY = e.touches[0].clientY;
  }
  
  if (state.activeCardElement) {
    state.activeCardElement.classList.add("is-dragging");
  }
}

function onDragMove(e) {
  if (!state.isDragging || !state.activeCardElement) return;

  if (e.type === "mousemove") {
    state.currentX = e.clientX;
    state.currentY = e.clientY;
  } else {
    state.currentX = e.touches[0].clientX;
    state.currentY = e.touches[0].clientY;
  }

  const deltaX = state.currentX - state.startX;
  const deltaY = state.currentY - state.startY;

  // Rotação suave proporcional ao arrasto horizontal
  const rotation = deltaX * 0.08;
  state.activeCardElement.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;

  // Controlar opacidade progressiva dos overlays na carta
  const overlayLike = state.activeCardElement.querySelector(".card-overlay.like");
  const overlayDislike = state.activeCardElement.querySelector(".card-overlay.dislike");
  
  if (deltaX > 0) {
    const opacity = Math.min(deltaX / SWIPE_THRESHOLD, 1);
    overlayLike.style.opacity = opacity;
    overlayDislike.style.opacity = 0;
  } else {
    const opacity = Math.min(Math.abs(deltaX) / SWIPE_THRESHOLD, 1);
    overlayDislike.style.opacity = opacity;
    overlayLike.style.opacity = 0;
  }
}

function onDragEnd() {
  if (!state.isDragging || !state.activeCardElement) return;
  
  state.isDragging = false;
  state.activeCardElement.classList.remove("is-dragging");

  const deltaX = state.currentX - state.startX;
  
  // Checar se o deslocamento ultrapassou o limiar de swipe
  if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
    const action = deltaX > 0 ? "like" : "dislike";
    executeSwipeAction(action);
  } else {
    // Resetar carta se não atingir o limiar
    state.activeCardElement.style.transform = "";
    const overlayLike = state.activeCardElement.querySelector(".card-overlay.like");
    const overlayDislike = state.activeCardElement.querySelector(".card-overlay.dislike");
    if (overlayLike) overlayLike.style.opacity = 0;
    if (overlayDislike) overlayDislike.style.opacity = 0;
  }

  // Limpar coordenadas
  state.startX = 0;
  state.startY = 0;
  state.currentX = 0;
  state.currentY = 0;
}

/**
 * Executa de forma lógica e visual o swipe
 */
function executeSwipeAction(action) {
  const card = state.activeCardElement;
  if (!card) return;

  const movieId = parseInt(card.dataset.id);
  const movie = state.deckQueue.find(m => m.id === movieId);
  
  if (!movie) return;

  // 1. Lançar animação de saída voando da tela
  const flyDirection = action === "like" ? 1000 : -1000;
  card.style.transform = `translate(${flyDirection}px, ${state.currentY - state.startY}px) rotate(${flyDirection * 0.1}deg)`;
  card.style.opacity = 0;

  // 2. Persistir ação no LocalStorage
  persistSwipeAction(movieId, action);

  // 3. Atualizar inteligência de recomendação
  if (action === "like") {
    updateRecommendationProfile(movie);
  }

  // 4. Remover da fila e atualizar o DOM após a animação
  setTimeout(() => {
    card.remove();
    
    // Remover o item da fila
    state.deckQueue.shift();
    state.activeCardElement = null;

    // Renderizar a fila atualizada
    renderDeck();

    // Trigger de Pre-fetching: Se restarem 3 ou menos itens no deck, carregar mais da API
    if (state.deckQueue.length <= 3) {
      fetchNextBatchOfMovies();
    }
  }, 300);
}

/**
 * Salva a interação (Like/Dislike) no LocalStorage e no Supabase
 */
function persistSwipeAction(movieId, actionType) {
  const watchlist = state.watchlist;

  if (actionType === "like") {
    if (!watchlist.likedIds.includes(movieId)) {
      watchlist.likedIds.push(movieId);
    }
  } else {
    if (!watchlist.dislikedIds.includes(movieId)) {
      watchlist.dislikedIds.push(movieId);
    }
  }

  watchlist.history.push({
    movieId: movieId,
    action: actionType,
    timestamp: Date.now()
  });

  localStorage.setItem("watchlist", JSON.stringify(watchlist));
  state.watchlist = watchlist;

  saveSwipeToSupabase(movieId, actionType);

  updateWatchlistBadge();
}

/**
 * Atualiza o badge de contador de filmes curtidos no botão "Meus Filmes"
 */
function updateWatchlistBadge() {
  const badge = document.getElementById("watchlist-badge");
  const count = state.watchlist.likedIds.length;

  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ==========================================================================
// Handlers de Interface (Eventos da UI)
// ==========================================================================
function setupEventListeners() {
  // Cliques nos Botões de Ação do Footer
  document.getElementById("btn-like").addEventListener("click", () => {
    if (state.activeCardElement) {
      state.currentX = 150; // Simular coordenada de arrasto
      executeSwipeAction("like");
    }
  });

  document.getElementById("btn-dislike").addEventListener("click", () => {
    if (state.activeCardElement) {
      state.currentX = -150; // Simular coordenada de arrasto
      executeSwipeAction("dislike");
    }
  });

  document.getElementById("btn-info").addEventListener("click", () => {
    if (state.activeCardElement) {
      const movieId = parseInt(state.activeCardElement.dataset.id);
      showMovieDetail(movieId);
    }
  });

  // Filtros
  document.getElementById("btn-filters").addEventListener("click", () => showModal("filters-modal"));
  document.getElementById("btn-close-filters").addEventListener("click", () => hideModal("filters-modal"));
  document.getElementById("btn-apply-filters").addEventListener("click", applyFilters);
  document.getElementById("btn-reset-filters").addEventListener("click", resetFilters);

  // Barra de Categorias (Gêneros rápidos)
  document.querySelectorAll(".category-pill").forEach(pill => {
    pill.addEventListener("click", async () => {
      // Remover active de todas as pills
      document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      // Ativar a pill clicada
      pill.classList.add("active");

      const genreId = parseInt(pill.dataset.genreId);

      // Atualizar filtro de gênero no estado
      if (genreId === 0) {
        state.filters.genres = []; // "Todas" = sem filtro de gênero
      } else {
        state.filters.genres = [genreId];
      }

      // Salvar e recarregar
      localStorage.setItem("filterSettings", JSON.stringify(state.filters));
      state.deckQueue = [];
      state.currentPage = 1;
      showLoading(true);
      await fetchNextBatchOfMovies();
      showLoading(false);
    });
  });

  // Configurações de Sliders de Filtro na UI
  const voteSlider = document.getElementById("filter-min-vote");
  const voteValue = document.getElementById("vote-value");
  voteSlider.addEventListener("input", (e) => {
    voteValue.textContent = `${parseFloat(e.target.value).toFixed(1)}/10`;
  });

  const runtimeSlider = document.getElementById("filter-max-runtime");
  const runtimeValue = document.getElementById("runtime-value");
  runtimeSlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    const hours = Math.floor(val / 60);
    const mins = val % 60;
    runtimeValue.textContent = hours > 0 ? `${val} min (${hours}h ${mins}m)` : `${val} min`;
  });

  // Watchlist Modal
  document.getElementById("btn-watchlist").addEventListener("click", showWatchlist);
  document.getElementById("btn-close-watchlist").addEventListener("click", () => hideModal("watchlist-modal"));
  document.getElementById("btn-clear-watchlist").addEventListener("click", clearWatchlist);
  
  // Limpeza de histórico no estado vazio
  document.getElementById("btn-clear-history").addEventListener("click", clearFullHistory);

  // Detalhes Modal
  document.getElementById("btn-close-detail").addEventListener("click", () => {
    hideModal("movie-detail-modal");
    // Parar reprodução do Iframe do YouTube ao fechar
    document.getElementById("detail-trailer-container").innerHTML = "";
  });

  // Configuração de API Chave Manual
  document.getElementById("btn-save-api").addEventListener("click", saveApiKeyManually);

  // Logout
  document.getElementById("btn-logout").addEventListener("click", async () => {
    if (confirm("Deseja sair da sua conta?")) {
      await supabaseClient.auth.signOut();
      localStorage.removeItem("watchlist");
      localStorage.removeItem("recommendationProfile");
      localStorage.removeItem("filterSettings");
      window.location.href = "login.html";
    }
  });
}

/**
 * Salva a API Key inserida na interface pelo usuário
 */
function saveApiKeyManually() {
  const bearerVal = document.getElementById("api-bearer-input").value.trim();
  const keyVal = document.getElementById("api-key-input").value.trim();

  if (!bearerVal && !keyVal) {
    alert("Por favor, preencha o Token Bearer ou a API Key.");
    return;
  }

  if (bearerVal) {
    localStorage.setItem("tmdb_bearer_token", bearerVal);
    state.tmdbBearerToken = bearerVal;
  } else {
    localStorage.setItem("tmdb_api_key", keyVal);
    state.tmdbApiKey = keyVal;
  }

  initializeAppFlow();
}

/**
 * Exibe modal de detalhes de um filme específico
 */
async function showMovieDetail(movieId) {
  const movie = state.deckQueue.find(m => m.id === movieId);
  if (!movie) return;

  document.getElementById("detail-title").textContent = movie.title;
  document.getElementById("detail-poster").src = movie.posterUrl;
  document.getElementById("detail-year").textContent = movie.releaseYear || "N/A";
  document.getElementById("detail-runtime").textContent = movie.runtimeText;
  document.getElementById("detail-vote").innerHTML = `<i class="fa-solid fa-star"></i> ${movie.voteAverage.toFixed(1)}`;
  document.getElementById("detail-overview").textContent = movie.overviewSummary;

  // Injetar Tags de Gêneros
  const genresEl = document.getElementById("detail-genres");
  genresEl.innerHTML = movie.genres.map(g => `<span class="genre-tag">${g}</span>`).join("");

  // Injetar Trailer do YouTube
  const trailerContainer = document.getElementById("detail-trailer-container");
  const posterImg = document.getElementById("detail-poster");
  
  if (movie.trailerUrl) {
    trailerContainer.innerHTML = `<iframe src="${movie.trailerUrl}?autoplay=0&mute=0" allowfullscreen></iframe>`;
    trailerContainer.classList.add("active");
    posterImg.style.display = "none";
  } else {
    trailerContainer.innerHTML = "";
    trailerContainer.classList.remove("active");
    posterImg.style.display = "block";
  }

  // Injetar logos dos provedores de streaming
  const providersEl = document.getElementById("detail-providers");
  providersEl.innerHTML = "";
  
  if (movie.providersLogos.length > 0) {
    movie.providersLogos.forEach(logo => {
      const img = document.createElement("img");
      img.className = "provider-detail-logo";
      img.src = logo;
      providersEl.appendChild(img);
    });
    document.querySelector(".detail-streaming").style.display = "block";
  } else {
    document.querySelector(".detail-streaming").style.display = "none";
  }

  showModal("movie-detail-modal");
}

/**
 * Monta e exibe a lista de filmes salvos (Watchlist)
 */
async function showWatchlist() {
  const body = document.getElementById("watchlist-body");
  body.innerHTML = "";

  showLoading(true);

  if (state.watchlist.likedIds.length === 0) {
    body.innerHTML = `
      <div class="watchlist-empty">
        <i class="fa-solid fa-face-meh"></i>
        <p>Sua lista está vazia!</p>
        <span>Curta filmes (swipe para direita) para salvá-los aqui.</span>
      </div>
    `;
    showModal("watchlist-modal");
    showLoading(false);
    return;
  }

  // Fazer fetch assíncrono das informações simplificadas dos filmes curtidos
  const promises = state.watchlist.likedIds.slice(-20).map(id => // Mostra os últimos 20 curtidos
    fetchMovieDetails(id).catch(() => null)
  );

  const results = await Promise.all(promises);
  showLoading(false);

  results.forEach(movieData => {
    if (movieData) {
      const itemEl = document.createElement("div");
      itemEl.className = "watchlist-item";
      itemEl.innerHTML = `
        <img src="https://image.tmdb.org/t/p/w342${movieData.poster_path}" alt="${movieData.title}">
        <div class="watchlist-item-info">
          <h4>${movieData.title}</h4>
          <span><i class="fa-solid fa-star"></i> ${movieData.vote_average.toFixed(1)}</span>
        </div>
      `;
      // Permitir abrir o modal de detalhes completos a partir do clique
      itemEl.addEventListener("click", () => {
        hideModal("watchlist-modal");
        const adapted = adaptToMovieCard(movieData);
        state.deckQueue.unshift(adapted); // Insere temporariamente no topo para exibir detalhes
        showMovieDetail(adapted.id);
      });
      body.appendChild(itemEl);
    }
  });

  showModal("watchlist-modal");
}

/**
 * Limpa a watchlist curtida (LocalStorage + Supabase)
 */
function clearWatchlist() {
  if (confirm("Tem certeza que deseja limpar sua lista de filmes curtidos?")) {
    state.watchlist.likedIds = [];
    state.watchlist.history = state.watchlist.history.filter(h => h.action !== "like");
    localStorage.setItem("watchlist", JSON.stringify(state.watchlist));
    clearWatchlistInSupabase();
    updateWatchlistBadge();
    showWatchlist();
  }
}

/**
 * Limpa todo o histórico (Curtidas e Rejeições) para recomeçar o Tinder do zero
 */
function clearFullHistory() {
  if (confirm("Deseja apagar todo o histórico de swipes? O app irá reiniciar do zero.")) {
    state.watchlist = { likedIds: [], dislikedIds: [], history: [] };
    state.recommendationProfile = { likedGenresFrequency: {}, averageVoteOfLiked: 0, totalLikes: 0, preferredYears: [] };
    localStorage.removeItem("watchlist");
    localStorage.removeItem("recommendationProfile");
    clearAllHistoryInSupabase();

    state.deckQueue = [];
    state.currentPage = 1;
    initializeAppFlow();
  }
}

/**
 * Aplica os filtros selecionados na interface e reinicia a busca do zero
 */
async function applyFilters() {
  // 1. Extrair gêneros selecionados
  const checkedGenres = Array.from(document.querySelectorAll("#genres-container input:checked"))
    .map(input => parseInt(input.value));
  state.filters.genres = checkedGenres;

  // 2. Extrair provedores selecionados
  const checkedProviders = Array.from(document.querySelectorAll("#providers-container input:checked"))
    .map(input => parseInt(input.value));
  state.filters.providers = checkedProviders;

  // 3. Extrair anos
  const minYear = document.getElementById("filter-min-year").value;
  const maxYear = document.getElementById("filter-max-year").value;
  state.filters.minReleaseYear = minYear ? parseInt(minYear) : null;
  state.filters.maxReleaseYear = maxYear ? parseInt(maxYear) : null;

  // 4. Extrair nota e duração
  state.filters.minVoteAverage = parseFloat(document.getElementById("filter-min-vote").value);
  state.filters.maxRuntime = parseInt(document.getElementById("filter-max-runtime").value);

  // Salvar no LocalStorage
  localStorage.setItem("filterSettings", JSON.stringify(state.filters));

  // Resetar o deck e buscar novamente
  state.deckQueue = [];
  state.currentPage = 1;
  hideModal("filters-modal");
  
  showLoading(true);
  await fetchNextBatchOfMovies();
  showLoading(false);
}

/**
 * Redefine todos os filtros e reinicia o catálogo
 */
async function resetFilters() {
  state.filters = {
    genres: [],
    minReleaseYear: null,
    maxReleaseYear: null,
    minVoteAverage: 6.0,
    maxRuntime: 180,
    providers: []
  };
  
  localStorage.removeItem("filterSettings");
  syncFilterUI();

  state.deckQueue = [];
  state.currentPage = 1;
  
  showLoading(true);
  await fetchNextBatchOfMovies();
  showLoading(false);
}

/**
 * Sincroniza a interface de filtros com o estado
 */
function syncFilterUI() {
  document.getElementById("filter-min-vote").value = state.filters.minVoteAverage;
  document.getElementById("vote-value").textContent = `${state.filters.minVoteAverage.toFixed(1)}/10`;
  
  document.getElementById("filter-max-runtime").value = state.filters.maxRuntime;
  document.getElementById("runtime-value").textContent = `${state.filters.maxRuntime} min`;

  document.getElementById("filter-min-year").value = state.filters.minReleaseYear || "";
  document.getElementById("filter-max-year").value = state.filters.maxReleaseYear || "";

  // Desmarcar todos e marcar apenas os ativos
  document.querySelectorAll("#genres-container input").forEach(input => {
    input.checked = state.filters.genres.includes(parseInt(input.value));
  });

  document.querySelectorAll("#providers-container input").forEach(input => {
    input.checked = state.filters.providers.includes(parseInt(input.value));
  });
}

// ==========================================================================
// Auxiliares de Renderização da UI
// ==========================================================================
function renderGenresFilters(genres) {
  const container = document.getElementById("genres-container");
  container.innerHTML = "";
  
  genres.forEach(g => {
    const label = document.createElement("label");
    label.className = "genre-checkbox-label";
    label.innerHTML = `
      <input type="checkbox" value="${g.id}" ${state.filters.genres.includes(g.id) ? "checked" : ""}>
      <span class="genre-tag-btn">${g.name}</span>
    `;
    container.appendChild(label);
  });
}

function renderProvidersFilters(providers) {
  const container = document.getElementById("providers-container");
  container.innerHTML = "";
  
  providers.forEach(p => {
    const label = document.createElement("label");
    label.className = "provider-checkbox-label";
    label.innerHTML = `
      <input type="checkbox" value="${p.id}" ${state.filters.providers.includes(p.id) ? "checked" : ""}>
      <div class="provider-logo-container">
        <img src="https://image.tmdb.org/t/p/w92${p.logoPath}" alt="${p.name}">
      </div>
      <span>${p.name}</span>
    `;
    container.appendChild(label);
  });
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function showLoading(visible) {
  const loadingEl = document.getElementById("deck-loading");
  if (visible) {
    loadingEl.classList.add("active");
  } else {
    loadingEl.classList.remove("active");
  }
}

function showEmptyState(visible) {
  const emptyEl = document.getElementById("deck-empty");
  if (visible) {
    emptyEl.classList.add("active");
  } else {
    emptyEl.classList.remove("active");
  }
}
