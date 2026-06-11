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
        // ENDPOINT ATUALIZADO (Riot Community Mirror): Puxa os dados direto do banco unificado
        const url = `https://api.g9v.cc/v1/valorant/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
        
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'ValorantTwitchBot/1.1' },
            timeout: 6000
        });

        if (response.data && response.data.rank) {
            const currentRank = response.data.rank;
            const rr = response.data.rr || 0;
            return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${currentRank} (${rr} RR)`);
        }
        
        throw new Error();

    } catch (error) {
        // FALLBACK SECUNDÁRIO INTEGRADO: Se o mirror oscilar, busca o cache rápido do HenriqueDev unificado para nuvem
        try {
            const fallbackUrl = `https://api.henrikdev.xyz/valorant/v1/mmr/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
            const fallbackRes = await axios.get(fallbackUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 4000
            });
            
            if (fallbackRes.data && fallbackRes.data.data) {
                const eloIngles = fallbackRes.data.data.currenttierpatched || 'Sem Rank';
                const points = fallbackRes.data.data.ranking_in_tier || 0;

                const traducoes = {
                    'Iron': 'Ferro', 'Bronze': 'Bronze', 'Silver': 'Prata', 'Gold': 'Ouro',
                    'Platinum': 'Platina', 'Diamond': 'Diamante', 'Ascendant': 'Ascendente',
                    'Immortal': 'Imortal', 'Radiant': 'Radiante'
                };

                let currentRank = eloIngles;
                Object.keys(traducoes).forEach(key => {
                    if (currentRank.includes(key)) currentRank = currentRank.replace(key, traducoes[key]);
                });

                return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${currentRank} (${points} RR)`);
            }
        } catch (e) {}

        // Mensagem final padrão mantida caso o jogador realmente não possua dados públicos salvos
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Perfil privado ou não encontrado. Certifique-se de que a Tag e o Nick estão digitados exatamente igual ao jogo.`);
    }
});

module.exports = router;