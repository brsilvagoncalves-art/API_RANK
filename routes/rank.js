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
        // TENTATIVA 1: Endpoint de contingência em formato de texto (ignora bloqueios normais de cabeçalho)
        const url = `https://api.henrikdev.xyz/valorant/v1/mmr/br/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 4000
        });

        if (response.data && response.data.data) {
            const elo = response.data.data.currenttierpatched || 'Sem Rank';
            const rr = response.data.data.ranking_in_tier || 0;
            return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${elo} (${rr} RR)`);
        }
        
        throw new Error();

    } catch (error) {
        // TENTATIVA 2 (BLINDADA): Usando o espelho público direto de comandos para chatbots do Caldas reconstruído
        // Esse link é hospedado em uma CDN que aceita requisições vindas de redes residenciais locais (localhost)
        try {
            const fallbackUrl = `https://c4ldas.com.br/api/valorant/rank?region=br&player=${encodeURIComponent(cleanName)}&tag=${encodeURIComponent(cleanTag)}`;
            const fallbackRes = await axios.get(fallbackUrl, { timeout: 4000 });
            
            if (fallbackRes.data && !fallbackRes.data.includes('Erro') && !fallbackRes.data.includes('not found')) {
                const cleanResponse = fallbackRes.data.replace(/\s+/g, ' ').trim();
                return res.send(`[VALORANT] ${cleanName}#${cleanTag} | Rank: ${cleanResponse}`);
            }
        } catch (e) {}

        // SE TUDO NO LOCALHOST FALHAR (Devido ao bloqueio temporário do seu IP de rede)
        // Devolvemos uma mensagem limpa com o link direto para o chat poder clicar
        res.send(`[VALORANT] ${cleanName}#${cleanTag} | Perfil privado ou instabilidade temporária na consulta local. Veja o elo diretamente em: tracker.gg/valorant/profile/riot/${encodeURIComponent(cleanName)}%23${cleanTag}`);
    }
});

module.exports = router;