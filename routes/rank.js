const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/valorant', async (req, res) => {
    const { name, tag } = req.query;

    if (!name || !tag) {
        return res.send('Erro: Você precisa informar o nome e a tag.');
    }

    const cleanName = name.trim();
    const cleanTag = tag.trim();

    try {
        // ENDPOINT PROFISSIONAL: HenrikDev V2 com suporte completo a caracteres especiais e espaços
        const url = `https://api.henrikdev.xyz/valorant/v2/mmr/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 6000
        });

        // Valida se os dados competitivos vieram estruturados de forma correta
        if (response.data && response.data.data && response.data.data.current_data) {
            const currentData = response.data.data.current_data;
            const eloIngles = currentData.currenttierpatched || 'Sem Rank';
            const rr = currentData.ranking_in_tier || 0;

            // Traduz os elos retornados pela API internacional
            const traducoes = {
                'Iron': 'Ferro', 'Bronze': 'Bronze', 'Silver': 'Prata', 'Gold': 'Ouro',
                'Platinum': 'Platina', 'Diamond': 'Diamante', 'Ascendant': 'Ascendente',
                'Immortal': 'Imortal', 'Radiant': 'Radiante'
            };

            let currentRank = eloIngles;
            Object.keys(traducoes).forEach(key => {
                if (currentRank.includes(key)) {
                    currentRank = currentRank.replace(key, traducoes[key]);
                }
            });

            return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${currentRank} (${rr} RR)`);
        }

        throw new Error("Dados não estruturados");

    } catch (error) {
        // Se a API retornar que o jogador não foi encontrado (404) ou se os dados falharem
        console.log("Erro tratado no Render:", error.message);
        
        // Mensagem padrão unificada e polida para o chat do Nightbot
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Perfil privado ou não encontrado. Certifique-se de que a Tag e o Nick estão digitados exatamente igual ao jogo.`);
    }
});

module.exports = router;