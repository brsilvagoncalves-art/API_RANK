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
        // TENTATIVA 1: VLR cache rápido
        const url = `https://api.vlr.gg/v1/players/${encodeURIComponent(cleanName.toLowerCase())}-${cleanTag.toLowerCase()}`;
        const response = await axios.get(url, { timeout: 4000 });

        if (response.data && response.data.rank) {
            return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${response.data.rank}`);
        }
        throw new Error();
    } catch (e) {
        try {
            // TENTATIVA 2: HenrikDev MMR estruturado
            const fallbackUrl = `https://api.henrikdev.xyz/valorant/v1/mmr/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
            const fallbackRes = await axios.get(fallbackUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 4000
            });

            if (fallbackRes.data && fallbackRes.data.data) {
                const eloIngles = fallbackRes.data.data.currenttierpatched || 'Sem Rank';
                const rr = fallbackRes.data.data.ranking_in_tier || 0;

                const traducoes = {
                    'Iron': 'Ferro', 'Bronze': 'Bronze', 'Silver': 'Prata', 'Gold': 'Ouro',
                    'Platinum': 'Platina', 'Diamond': 'Diamante', 'Ascendant': 'Ascendente',
                    'Immortal': 'Imortal', 'Radiant': 'Radiante'
                };

                let currentRank = eloIngles;
                Object.keys(traducoes).forEach(key => {
                    if (currentRank.includes(key)) currentRank = currentRank.replace(key, traducoes[key]);
                });

                return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${currentRank} (${rr} RR)`);
            }
            throw new Error();
        } catch (err) {
            try {
                // TENTATIVA 3 (O pulo do gato para o Render): Endpoint público alternativo de texto
                // Como o Render usa IP americano/europeu, ele acessa essa rota sem problemas de travamento local
                const txtUrl = `https://api.kyros.tv/valorant/v1/profile/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
                const txtRes = await axios.get(txtUrl, { timeout: 4000 });
                
                if (txtRes.data && txtRes.data.rank) {
                    return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${txtRes.data.rank}`);
                }
            } catch (txtErr) {}

            // Resposta caso o jogador realmente não exista ou a tag esteja errada
            res.send(`[VALORANT] ${cleanName}#${cleanTag} | Perfil privado ou não encontrado. Verifique se digitou o Nick e a Tag exatamente como aparecem no jogo.`);
        }
    }
});

module.exports = router;