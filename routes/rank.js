const express = require('express');
const router = express.Router();
const HenrikDevValorantAPI = require('unofficial-valorant-api');

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

        // Cache local de 1 minuto para proteção de taxa da API
        if (cached && Date.now() - cached.timestamp < 60000) {
            rankData = cached.data;
        } else {
            // 1. Busca os dados de Elo atuais
            const mmr_data = await vapi.getMMR({ 
                version: 'v2', 
                region: 'br', 
                name: cleanName, 
                tag: cleanTag 
            });

            if (mmr_data.error || !mmr_data.data?.current_data?.currenttierpatched) {
                throw new Error("Perfil sem dados competitivos recentes.");
            }

            // 2. Busca o histórico estendido de partidas
            let vitorias = 0;
            let derrotas = 0;
            
            try {
                const matches = await vapi.getMatches({
                    region: 'br',
                    name: cleanName,
                    tag: cleanTag,
                    size: 25 // Limite alto para garantir que lê todas as partidas do dia
                });

                if (matches.data && Array.isArray(matches.data)) {
                    // Obtém a data de HOJE no fuso horário de Brasília (Formato: DD/MM/AAAA)
                    const hojeBrasil = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

                    matches.data.forEach(match => {
                        // Converte o timestamp do início da partida para a data no fuso de Brasília
                        const dataPartidaBrasil = new Date(match.metadata.game_start * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

                        // Se a partida aconteceu na data de hoje no Brasil, ela entra na soma
                        if (dataPartidaBrasil === hojeBrasil) {
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
                console.log("Erro ao computar histórico de partidas:", matchError.message);
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

        // Tradução do Elo para português brasileiro
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

        // Retorna a string limpa idêntica ao formato esperado pelo Nightbot
        return res.send(`[VALORANT] ${rankData.name}#${rankData.tag} | Rank: ${currentRank} (${rankData.rr} RR) | Histórico de Hoje: ${rankData.vitorias}V / ${rankData.derrotas}D`);

    } catch (error) {
        console.log("Erro na execução geral:", error.message);
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Erro ao carregar elo. Verifique se o Nick/Tag estão corretos.`);
    }
});

module.exports = router;