# 📋 Task Plan: TinderMovie

## 🎯 Objetivos Gerais
Construir uma aplicação web responsiva (Mobile First) que funciona como um "Tinder para filmes", permitindo ao usuário fazer swipes para a esquerda (rejeitar) e para a direita (curtir/quero assistir) utilizando dados em tempo real integrados com a API do TMDB. A aplicação operará de forma client-side pura com persistência de dados local (LocalStorage).

---

## 🗺️ Fases do Projeto

### 🟢 Fase 1: Blueprint (Vision & Logic)
- [x] Inicializar a memória do projeto (`gemini.md`, `findings.md`, `progress.md`, `task_plan.md`)
- [x] Desenvolver JSON Data Schemas das entidades em `gemini.md`
- [x] Elaborar a estratégia de integração da API do TMDB e da persistência em LocalStorage (`findings.md`)
- [x] Submeter o Blueprint inicial para feedback e obter aprovação do usuário

### ⚡ Fase 2: Link (Connectivity)
- [x] Criar o arquivo `.env.example` para documentar a configuração da API Key do TMDB
- [x] Escrever script de handshake em `tools/handshake_tmdb.py` para validar a API Key localmente e testar requisições para a API do TMDB
- [x] Tratar e testar respostas para casos de chaves inválidas ou de problemas de conectividade

### ⚙️ Fase 3: Architect (A.N.T. Three-Layer Build)
- [ ] **Camada 1: Architecture (`architecture/`)**
  - [x] Criar `architecture/SOP_TMDB_client.md` especificando paginação, filtros e tratamento de dados
  - [x] Criar `architecture/SOP_deck_state.md` especificando transição de cards, gestos de swipe, cache de curtidas e rejeições
  - [x] Criar `architecture/SOP_recommendation.md` especificando o motor de recomendação simples por peso de gêneros
- [ ] **Camada 3: Tools & Core Scripts (`tools/`)**
  - [ ] Implementar scripts auxiliares necessários para testes ou build
- [x] **Camada 2: Navigation & Core App (`src/`)**
  - [x] Estruturar a aplicação frontend em `/Users/robertorezendejr/Documents/www/TinderMovie/src/`
  - [x] Criar `src/index.html` com marcação semântica e SEO básico
  - [x] Desenvolver `src/app.js` implementando:
    - Cliente TMDB (busca de gêneros, discover, watch providers)
    - Gerenciador de estado local e persistência em LocalStorage
    - Algoritmo de recomendação simples
    - Gerenciamento de deck e gestos de swipe
  - [x] Criar `src/index.css` com o design system do app (variáveis CSS, HSL colors, regras de layout)

### ✨ Fase 4: Stylize (Visual Refinement)
- [ ] Aplicar design estético premium no `src/index.css` (Glassmorphism, transições fluidas de swipe, modo escuro nativo)
- [ ] Adicionar suporte a gestos de toque em dispositivos mobile (eventos `touchstart`, `touchmove`, `touchend`)
- [ ] Adicionar micro-animações nas ações de swipe (indicadores visuais de "Quero Assistir" e "Não Gostei" ao arrastar)
- [ ] Criar tela de preferências e de filtros amigável com transições suaves (Popovers/Modais)
- [ ] Validar a interface e a responsividade em múltiplos tamanhos de tela

### 🛰️ Fase 5: Trigger (Deployment & Automation)
- [ ] Organizar o script de build final ou preparação para deploy estático
- [ ] Documentar o fluxo de implantação final na cloud (ex: Firebase Hosting, Netlify ou GitHub Pages)
- [ ] Preencher e revisar o **Maintenance Log** em `gemini.md`
- [ ] Criar `walkthrough.md` com o resumo detalhado do projeto final e demonstrações

---

## 📝 Checklist Detalhado de Tarefas do MVP

### 1. Inicialização e Blueprint
- [x] Criar estrutura de arquivos base
- [x] Definir formatos JSON Schemas
- [x] Avaliar e decidir LocalStorage vs IndexedDB

### 2. Configurações de API & TMDB
- [ ] Implementar carregador de API Key via interface (para que o usuário possa digitar sua própria chave na UI caso não queira usar variáveis de build estáticas)
- [ ] Criar função de busca e mapeamento de IDs de gêneros TMDB
- [ ] Criar filtro de provedores de streaming (watch providers) no Brasil (`region=BR`)

### 3. Mecânica do Deck (Swiper)
- [ ] Implementar pilha de cartas empilhadas ordenadas por z-index
- [ ] Desenvolver lógica de arrastar carta com mouse (desktop) e touch (mobile)
- [ ] Calcular ângulo e translação da carta durante o movimento de arrastar
- [ ] Implementar limiar (threshold) de swipe para disparar a ação de Like/Dislike
- [ ] Desenvolver animação de descarte da carta para fora da tela e re-empilhamento das cartas de baixo

### 4. Persistência e Motor de Recomendação
- [ ] Persistir listas de curtidos e rejeitados no LocalStorage com salvamento imediato
- [ ] Filtrar novos itens da API para nunca incluir IDs já existentes no LocalStorage
- [ ] Construir o ranqueador: contar frequência de gêneros curtidos, calcular pesos de importância e reordenar a pilha de novos cards antes de renderizá-los

### 5. Apresentação Visual e Polimento
- [ ] Paleta de cores premium (escuro minimalista com gradientes vibrantes nos botões de swipe)
- [ ] Exibição rápida de trailers via iframe do YouTube (modal ou colapsável dentro do card)
- [ ] Exibição visível dos provedores de streaming de cada filme no card
- [ ] Adicionar feedback tátil e sonoro se aplicável (opcional/micro-interações de hover)
