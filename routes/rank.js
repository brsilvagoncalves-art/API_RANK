const express = require('express');
const router = express.Router();
const HenrikDevValorantAPI = require('unofficial-valorant-api');
const axios = require('axios');

const vapi = new HenrikDevValorantAPI(process.env.HENRIK_ADVANCE_KEY);
const cache = {};

router.get('/valorant', async (req, res) => {
    const { name, tag } = req.query;

    if (!name || !tag) {
        return res.send('Erro: Você precisa informar o nome e a tag.');
    }

    const cleanName = name.trim();
    const cleanTag = tag.trim();
    const cacheKey = `br-${cleanName.toLowerCase()}-${cleanTag.toLowerCase()}`;

    try {
        let rankData;
        const cached = cache[cacheKey];

        if (cached && Date.now() - cached.timestamp < 60000) {
            rankData = cached.data;
        } else {
            // 1. Busca os dados de Elo atuais (Funciona perfeitamente pelo SDK)
            const mmr_data = await vapi.getMMR({ 
                version: 'v2', 
                region: 'br', 
                name: cleanName, 
                tag: cleanTag 
            });

            if (mmr_data.error || !mmr_data.data?.current_data?.currenttierpatched) {
                throw new Error("Perfil sem dados competitivos recentes.");
            }

            // 2. Busca o histórico de partidas direto da URL da API v3
            let vitorias = 0;
            let derrotas = 0;
            
            try {
                // Chamada direta na rota estável de histórico
                const urlMatches = `https://api.henrikdev.com/valorant/v3/matches/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}?mode=competitive`;
                
                const response = await axios.get(urlMatches, {
                    headers: { 'Authorization': process.env.HENRIK_ADVANCE_KEY }
                });

                // Na v3 direta do Axios, a lista de partidas pode vir direto em response.data ou response.data.data
                const matchesList = response.data?.data || response.data;

                if (matchesList && Array.isArray(matchesList)) {
                    const agora = Date.now();
                    const limiteJanelaStream = 15 * 60 * 60 * 1000; // Janela de 15 horas atrás para pegar a live de hoje

                    matchesList.forEach(match => {
                        // A API do Henrik entrega o game_start em segundos. Multiplicamos por 1000 para virar milissegundos.
                        const gameStartSeconds = match.metadata?.game_start || match.metadata?.start_in_timestamp;
                        const matchTimestamp = gameStartSeconds * 1000;

                        // Se a partida aconteceu dentro da janela de tempo da stream de hoje, nós contamos
                        if (matchTimestamp && (agora - matchTimestamp < limiteJanelaStream)) {
                            const player = match.players?.all_players?.find(
                                p => p.name.toLowerCase() === cleanName.toLowerCase()
                            );
                            
                            if (player) {
                                const playerTeam = player.team?.toLowerCase();
                                const teamStats = match.teams?.[playerTeam];
                                
                                if (teamStats) {
                                    if (teamStats.has_won) {
                                        vitorias++;
                                    } else {
                                        derrotas++;
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (matchError) {
                console.log("Erro na leitura da API de partidas:", matchError.message);
            }

            rankData = {
                rank: mmr_data.data.current_data.currenttierpatched,
                rr: mmr_data.data.current_data.ranking_in_tier,
                name: mmr_data.data.name,
                tag: mmr_data.data.tag,
                vitorias,
                derrotas
            };

            cache[cacheKey] = { data: rankData, timestamp: Date.now() };
        }

        const traducoes = {
            'Iron': 'Ferro', 'Bronze': 'Bronze', 'Silver': 'Prata', 'Gold': 'Ouro',
            'Platinum': 'Platina', 'Diamond': 'Diamante', 'Ascendant': 'Ascendente',
            'Immortal': 'Imortal', 'Radiant': 'Radiante'
        };

        let currentRank = rankData.rank;
        Object.keys(traducoes).forEach(key => {
            if (currentRank.includes(key)) {
                currentRank = currentRank.replace(key, traducoes[key]);
            }
        });

        return res.send(`[VALORANT] ${rankData.name}#${rankData.tag} | Rank: ${currentRank} (${rankData.rr} RR) | Histórico de Hoje: ${rankData.vitorias}V / ${rankData.derrotas}D`);

    } catch (error) {
        console.log("Erro geral:", error.message);
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Erro ao carregar elo. Verifique se o Nick/Tag estão corretos.`);
    }
});

module.exports = router;