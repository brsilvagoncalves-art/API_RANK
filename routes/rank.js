const express = require('express');
const router = express.Router();
const HenrikDevValorantAPI = require('unofficial-valorant-api');
const axios = require('axios'); // 🔥 Importa o Axios para termos controle total das requisições

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

        // Cache local de 1 minuto para não estourar a cota da chave
        if (cached && Date.now() - cached.timestamp < 60000) {
            rankData = cached.data;
        } else {
            // 1. Busca os dados de Elo atuais usando o SDK (que funciona perfeitamente)
            const mmr_data = await vapi.getMMR({ 
                version: 'v2', 
                region: 'br', 
                name: cleanName, 
                tag: cleanTag 
            });

            if (mmr_data.error || !mmr_data.data?.current_data?.currenttierpatched) {
                throw new Error("Perfil sem dados competitivos recentes.");
            }

            // 2. Busca o histórico de partidas DIRETAMENTE via Axios para quebrar as limitações do SDK
            let vitorias = 0;
            let derrotas = 0;
            
            try {
                // Montamos a URL nativa do HenrikDev forçando 25 partidas e desativando o cache deles (?uncached=true)
                const urlMatches = `https://api.henrikdev.com/valorant/v3/matches/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}?limit=25&mode=competitive&uncached=true`;
                
                const response = await axios.get(urlMatches, {
                    headers: {
                        'Authorization': process.env.HENRIK_ADVANCE_KEY // Envia sua chave de produção com segurança
                    }
                });

                const matchesData = response.data;

                if (matchesData && Array.isArray(matchesData.data)) {
                    // Obtém a data de HOJE no fuso horário de Brasília (Formato: DD/MM/AAAA)
                    const hojeBrasil = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

                    matchesData.data.forEach(match => {
                        const dataPartidaBrasil = new Date(match.metadata.game_start * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                        
                        const modoJogo = match.metadata.mode;
                        const ehCompetitivo = modoJogo && modoJogo.toLowerCase() === 'competitive';

                        if ((dataPartidaBrasil === hojeBrasil) && ehCompetitivo) {
                            const player = match.players.all_players.find(
                                p => p.name.toLowerCase() === cleanName.toLowerCase()
                            );
                            
                            if (player) {
                                const playerTeam = player.team.toLowerCase();
                                const teamStats = match.teams[playerTeam];
                                
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
                console.log("Erro na requisição direta de partidas:", matchError.message);
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

        // Tradução do Elo para português
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
        console.log("Erro na execução geral:", error.message);
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Erro ao carregar elo. Verifique se o Nick/Tag estão corretos.`);
    }
});

module.exports = router;