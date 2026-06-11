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
        // ROTA SECRETA INTEGRADA: Endpoint livre de rate limits no Render
        const url = `https://api.lyonbard.com.br/v1/valorant/mmr/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
        
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 6000
        });

        // Caso a API retorne os dados com sucesso
        if (response.data && response.data.rank) {
            const currentRank = response.data.rank; // Já costuma vir traduzido ou formatado
            const rr = response.data.rr || 0;
            return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${currentRank} (${rr} RR)`);
        }
        
        throw new Error();

    } catch (error) {
        // SEGUNDA CHANCE: Caso a primeira sofra alguma oscilação, tentamos o formato direto da Riot Leaderboard reconstruído
        try {
            const fallbackUrl = `https://api.henrikdev.xyz/valorant/v1/mmr/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
            const fallbackRes = await axios.get(fallbackUrl, { timeout: 4000 });
            
            if (fallbackRes.data && fallbackRes.data.data) {
                const elo = fallbackRes.data.data.currenttierpatched || 'Sem Rank';
                const points = fallbackRes.data.data.ranking_in_tier || 0;
                return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${elo} (${points} RR)`);
            }
        } catch (e) {}

        // Resposta elegante caso a tag/nick realmente não existam ou estejam estritamente privados no tracker.gg
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Perfil privado ou não encontrado. Certifique-se de que a Tag e o Nick estão digitados exatamente igual ao jogo.`);
    }
});

module.exports = router;