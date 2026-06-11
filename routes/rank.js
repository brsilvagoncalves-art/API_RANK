const express = require('express');
const router = express.Router();
const HenrikDevValorantAPI = require('unofficial-valorant-api');

// Inicializa a API utilizando a chave de ambiente que você vai colocar no Render
const vapi = new HenrikDevValorantAPI(process.env.HENRIK_ADVANCE_KEY);

// Objeto de cache local na memória do servidor para evitar Rate Limits
const cache = {};

router.get('/valorant', async (req, res) => {
    const { name, tag } = req.query;

    if (!name || !tag) {
        return res.send('Erro: Você precisa informar o nome e a tag.');
    }

    const cleanName = name.trim();
    const cleanTag = tag.trim();

    // Chave única de cache baseada no jogador
    const cacheKey = `br-${cleanName.toLowerCase()}-${cleanTag.toLowerCase()}`;

    try {
        let rankData;

        // VERIFICAÇÃO DE CACHE: Se os dados existirem e tiverem menos de 5 minutos (300.000 ms), usa o cache
        const cached = cache[cacheKey];
        if (cached && Date.now() - cached.timestamp < 300000) {
            rankData = cached.data;
        } else {
            // Se não estiver no cache ou expirou, faz a chamada oficial usando o pacote
            const mmr_data = await vapi.getMMR({ 
                version: 'v2', 
                region: 'br', 
                name: cleanName, 
                tag: cleanTag 
            });

            // Validação estrita exatamente igual ao exemplo funcional
            if (mmr_data.error || !mmr_data.data?.current_data?.currenttierpatched) {
                throw new Error("Perfil sem dados competitivos recentes ou Riot ID incorreto.");
            }

            // Estrutura os dados limpos
            rankData = {
                rank: mmr_data.data.current_data.currenttierpatched,
                rr: mmr_data.data.current_data.ranking_in_tier,
                name: mmr_data.data.name,
                tag: mmr_data.data.tag
            };

            // Salva no cache com o timestamp atual
            cache[cacheKey] = { data: rankData, timestamp: Date.now() };
        }

        // Dicionário profissional de tradução para manter em português no chat do streamer
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

        // Formato de resposta limpo e direto padrão para o Nightbot
        return res.send(`[VALORANT] ${rankData.name}#${rankData.tag} | Rank: ${currentRank} (${rankData.rr} RR)`);

    } catch (error) {
        console.log("Erro tratado na API profissional:", error.message);
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Não foi possível carregar o elo. Certifique-se de que o perfil está PÚBLICO no tracker.gg e que o Nick/Tag estão corretos.`);
    }
});

module.exports = router;