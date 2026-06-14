# 🔍 Findings: TinderMovie

## 🎬 API do TMDB (The Movie Database)

### 1. Criação de Conta e Obtenção da API Key
Para utilizar os dados de filmes do TMDB, é necessário obter uma chave de acesso (API Key):
1. Acesse o site do [TMDB](https://www.themoviedb.org/) e crie uma conta gratuita.
2. Após o login e verificação de e-mail, vá nas configurações da sua conta (Account Settings) clicando no seu avatar.
3. Acesse a aba **API** no menu lateral esquerdo.
4. Clique em **Create** na seção de solicitações de chave API e selecione o tipo de aplicação como "Developer".
5. Aceite os termos de uso e preencha as informações básicas do projeto (TinderMovie).
6. Copie a chave de API gerada (API Key v3) ou o token de leitura de API (Bearer Token v4). No nosso projeto, usaremos o **Bearer Token (v4)** por questões de segurança e boas práticas em cabeçalhos HTTP.

### 2. Limites e Regras de Uso da API
- **Limites de Rate Limit**: O TMDB não possui mais o limite rígido histórico de 40 requisições por 10 segundos. No entanto, eles aplicam limitação de taxa adaptável se houver abuso. O recomendável é manter as requisições abaixo de um volume excessivo e utilizar cache local quando possível.
- **Termos de Atribuição**: É obrigatório atribuir os créditos dos dados ao TMDB exibindo o logotipo oficial deles na interface do aplicativo (com o texto/link indicando que o TinderMovie utiliza a API do TMDB, mas não é endossado por eles).

### 3. Endpoints Recomendados para o Projeto
- **Descoberta de Filmes (Discover)**:
  `GET /3/discover/movie`
  - *Parâmetros chave*:
    - `language=pt-BR` (Português Brasil)
    - `region=BR` (Região Brasil para streaming)
    - `sort_by=popularity.desc` (Ordenação por popularidade)
    - `page={numero_pagina}` (Paginação para carregar mais filmes)
    - `with_genres={ids_generos}` (Filtro por gêneros desejados)
    - `vote_average.gte={nota_minima}` (Nota mínima do TMDB)
    - `primary_release_year={ano}` ou `primary_release_date.gte`/`lte` (Filtros de data)
    - `with_watch_providers={ids_provedores}` (Filtro por plataformas de streaming)
    - `watch_region=BR` (Necessário se filtrar por watch providers)
- **Detalhes Completos do Filme**:
  `GET /3/movie/{movie_id}`
  - *Parâmetros chave*:
    - `language=pt-BR`
    - `append_to_response=videos,watch/providers` (Traz em uma única chamada os vídeos/trailers e os provedores de streaming locais, reduzindo requisições extras).
- **Provedores de Streaming Disponíveis (Configuração Geral)**:
  `GET /3/watch/providers/movie`
  - Usado para obter a lista de provedores ativos na região (`watch_region=BR`) e seus respectivos logotipos, permitindo preencher a lista de filtros.
- **Lista de Gêneros de Filmes**:
  `GET /3/genre/movie/list`
  - Retorna os IDs e nomes dos gêneros em português para alimentar os filtros do aplicativo.

### 4. Dados Úteis a Serem Extraídos do TMDB
- `id`: Identificador único do filme.
- `title`: Título do filme.
- `overview`: Sinopse (se vazia, descartar o filme do deck).
- `poster_path`: URL do pôster (formar link usando `https://image.tmdb.org/t/p/w500{poster_path}`).
- `release_date`: Data de lançamento (extrair o ano).
- `vote_average`: Nota média dos usuários do TMDB.
- `genres`: Lista de gêneros (mapear os nomes).
- `runtime`: Duração em minutos (obtido nos detalhes do filme).
- `videos`: Vídeos do YouTube associados (filtrar por `type == "Trailer"` e `site == "YouTube"` para pegar a chave do trailer).
- `watch/providers`: Extrair a lista do nó `results.BR.flatrate` para as plataformas onde o filme está em catálogo (assinatura padrão).

---

## 💾 Estratégia de Persistência Local: LocalStorage vs. IndexedDB

Para o MVP do TinderMovie, avaliamos os dois mecanismos de armazenamento disponíveis no navegador:

### 1. LocalStorage
- **Prós**:
  - API extremamente simples, síncrona e direta (`localStorage.setItem('key', JSON.stringify(data))`).
  - Sem necessidade de dependências ou códigos complexos.
  - Perfeito para salvar dados pequenos: preferências de filtros, IDs de filmes curtidos (Watchlist) e rejeitados.
- **Contras**:
  - Limite rígido de aproximadamente 5MB de armazenamento.
  - Síncrono (operações pesadas podem travar a renderização, embora para nosso volume de dados isso não ocorra).

### 2. IndexedDB
- **Prós**:
  - Armazenamento assíncrono (não bloqueia a thread de renderização).
  - Capacidade virtualmente ilimitada (depende do disco do usuário, tipicamente centenas de MBs).
  - Permite armazenar objetos complexos e fazer queries indexadas.
- **Contras**:
  - API nativa altamente complexa baseada em callbacks e transações.
  - Exige muito código boilerplate ou dependências adicionais (`Dexie.js`, `idb`) para ser produtivo.

### 💡 Decisão
Para o **MVP**, a abordagem recomendada é o **LocalStorage**.
- **Justificativa**: A persistência do TinderMovie consiste essencialmente em salvar a lista de IDs curtidos e rejeitados, além das configurações de filtros e preferências. Esses dados combinados dificilmente passarão de alguns kilobytes (por exemplo, 10.000 IDs de filmes ocupam menos de 100KB). Usar IndexedDB introduziria complexidade desnecessária sem ganho real de performance ou capacidade.
