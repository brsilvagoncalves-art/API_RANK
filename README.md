# 🎮 VALORANT Live Rank & Daily History API

Uma API REST simples e eficiente desenvolvida em **Node.js** e **Express** para criadores de conteúdo e streamers de VALORANT. O projeto conecta-se à API do HenrikDev (Unofficial Valorant API) para gerar uma resposta em texto puro, otimizada para integração direta com bots de chat de transmissão (como **Nightbot**, **Streamelements** ou **Fossabot**).

A API retorna em tempo real o Rank (Elo) atual, a quantidade de Rank Rating (RR) e o placar acumulado de Vitórias e Derrotas do streamer no dia civil atual.

---

## ✨ Funcionalidades

* 📈 **Elo em Tempo Real:** Retorna o nível de rank atualizado com tradução automática para o Português Brasileiro (ex: *Imortal 1*, *Diamante 3*).
* 🔄 **Histórico Diário Expandido:** Lista e calcula o placar de Vitórias/Derrotas baseado no fuso horário do Brasil (`America/Sao_Paulo`).
* 🚀 **Fura-Fila de Cache:** Utiliza chamadas diretas via `axios` à API Lifetime para contornar limitações de paginação do SDK padrão, computando mais de 10 partidas por dia sem travar o placar.
* ⚡ **Gerenciamento de Taxa (Cache Local):** Implementa um sistema de cache em memória de 1 minuto para proteger sua chave de API contra excesso de requisições (*Rate Limiting*) causadas por spam no chat.

---

## 🛠️ Tecnologias Utilizadas

* **Node.js** (Ambiente de execução)
* **Express** (Framework web)
* **Axios** (Cliente HTTP para requisições externas)
* **Unofficial Valorant API (HenrikDev)** (Provedor dos dados da Riot Games)

---
