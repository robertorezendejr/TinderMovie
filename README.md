<div align="center">

<img src="src/assets/icon.png" alt="TinderMovie Logo" width="100" style="border-radius: 20px;" />

# TinderMovie

**Descubra seu próximo filme favorito — um swipe de cada vez.**

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![TMDB](https://img.shields.io/badge/TMDB-01B4E4?style=flat-square&logo=themoviedatabase&logoColor=white)](https://www.themoviedb.org)

</div>

---

## Sobre o Projeto

**TinderMovie** é uma aplicação web de descoberta de filmes inspirada na mecânica de swipe do Tinder. O usuário vê um card por vez com pôster, nota, descrição e onde o filme está disponível — e decide em segundos: curtiu ou passou. Os filmes curtidos formam uma lista personalizada, e o sistema aprende com suas escolhas ao longo do tempo.

---

## Telas do Aplicativo

### 1 — Login

<div align="center">
  <img src="docs/screenshots/1-login.png" alt="Tela de Login" width="420" />
</div>

Acesso seguro com e-mail e senha. Conta com alternância entre **Entrar** e **Criar Conta**, campo de senha com toggle de visibilidade e link para redefinição de senha.

---

### 2 — Descoberta de Filmes

<div align="center">
  <img src="docs/screenshots/2-main.png" alt="Tela Principal" width="720" />
</div>

A tela principal exibe um deck de cards com filmes. Cada card mostra:

- Pôster em alta resolução
- Nota e duração
- Título, ano e gênero
- Sinopse resumida
- Logos dos serviços de streaming onde o filme está disponível

A navegação por gênero no topo permite filtrar rapidamente por categorias como Ação, Aventura, Animação e Comédia.

---

### 3 — Meus Filmes

<div align="center">
  <img src="docs/screenshots/3-watchlist.png" alt="Meus Filmes" width="720" />
</div>

Painel com todos os filmes curtidos, organizados em grade com pôster e nota. Inclui opção de limpar a lista completa.

---

## Como Funciona

```
Usuário faz login
      │
      ▼
Sistema carrega filmes via TMDB API
      │
      ▼
Cards são exibidos um a um
      │
      ├── Swipe direito (❤️ curtiu) ──► Salvo na watchlist
      │
      └── Swipe esquerdo (✕ passou) ──► Ignorado / aprendizado
                    │
                    ▼
         Perfil de preferências atualizado
                    │
                    ▼
         Próximas sugestões mais precisas
```

---

## Arquitetura

O projeto é uma **Single Page Application (SPA)** em HTML, CSS e JavaScript puro — sem frameworks. A estrutura segue a arquitetura **A.N.T.**:

| Camada | Responsabilidade |
|--------|-----------------|
| **A** — Auth & State | Autenticação de usuário e estado global da aplicação |
| **N** — Navigation & Core | Lógica de deck, swipe, filtros e categorias |
| **T** — Third-party & Data | Integração com APIs externas e persistência de dados |

---

## Integrações Externas

### 🎬 TMDB — The Movie Database
> [themoviedb.org](https://www.themoviedb.org)

Fonte de todos os dados cinematográficos da aplicação: pôsteres, sinopses, notas, duração, gêneros, elenco e informações de disponibilidade em plataformas de streaming por região.

### 🔐 Supabase
> [supabase.com](https://supabase.com)

Backend como serviço responsável por:
- **Autenticação** de usuários (e-mail + senha)
- **Banco de dados** PostgreSQL para persistência da watchlist
- **Sincronização** do histórico de swipes entre sessões

---

## Estrutura do Projeto

```
TinderMovie/
├── src/
│   ├── index.html          # App principal
│   ├── login.html          # Tela de autenticação
│   ├── reset-password.html # Redefinição de senha
│   ├── app.js              # Lógica core da aplicação
│   ├── index.css           # Estilos do app
│   ├── login.css           # Estilos da autenticação
│   ├── supabase-client.js  # Configuração do cliente Supabase
│   └── config.js           # Configuração das APIs (não versionado)
├── docs/
│   └── screenshots/        # Capturas de tela do app
└── README.md
```

---

## Funcionalidades

- [x] Autenticação com e-mail e senha
- [x] Deck de filmes com mecânica de swipe
- [x] Filtro por gênero via barra de categorias
- [x] Exibição de streaming disponível por filme
- [x] Watchlist persistida no banco de dados
- [x] Sincronização entre sessões e dispositivos
- [x] Perfil de recomendação adaptativo
- [x] Filtros avançados (ano, nota, duração, streaming)

---

<div align="center">

Feito com ❤️ e muito swipe

</div>
