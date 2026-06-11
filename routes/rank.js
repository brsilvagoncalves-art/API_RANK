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
            // 1. Busca o Elo (SDK)
            const mmr_data = await vapi.getMMR({ 
                version: 'v2', 
                region: 'br', 
                name: cleanName, 
                tag: cleanTag 
            });

            if (mmr_data.error || !mmr_data.data?.current_data?.currenttierpatched) {
                throw new Error("Perfil sem dados competitivos recentes.");
            }

            // 2. Busca o histórico de Carreira via Axios para quebrar o limite de 10 partidas
            let vitorias = 0;
            let derrotas = 0;
            
            try {
                // 🔥 CORREÇÃO MÁXIMA: Domínio .xyz !
                const urlLifetime = `https://api.henrikdev.xyz/valorant/v1/lifetime/matches/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}?mode=competitive&size=25`;
                
                const response = await axios.get(urlLifetime, {
                    headers: { 'Authorization': process.env.HENRIK_ADVANCE_KEY }
                });

                const matchesList = response.data.data;

                if (matchesList && Array.isArray(matchesList)) {
                    const hojeBrasil = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

                    matchesList.forEach(match => {
                        const dataPartidaBrasil = new Date(match.meta.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

                        if (dataPartidaBrasil === hojeBrasil) {
                            // Verifica o time do jogador e a pontuação
                            const myTeam = match.stats.team.toLowerCase(); 
                            const myScore = match.teams[myTeam];
                            
                            const enemyTeam = myTeam === 'red' ? 'blue' : 'red';
                            const enemyScore = match.teams[enemyTeam];
                            
                            if (myScore > enemyScore) {
                                vitorias++;
                            } else if (enemyScore > myScore) {
                                derrotas++;
                            }
                        }
                    });
                }
            } catch (matchError) {
                console.log("Erro na API Lifetime:", matchError.message);
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