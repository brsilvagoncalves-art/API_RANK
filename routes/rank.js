const express = require('express');
const router = express.Router();
const HenrikDevValorantAPI = require('unofficial-valorant-api');

const vapi = new HenrikDevValorantAPI(process.env.HENRIK_ADVANCE_KEY);

router.get('/valorant', async (req, res) => {
    const { name, tag } = req.query;

    if (!name || !tag) {
        return res.send('Erro: Você precisa informar o nome e a tag.');
    }

    try {
        const matches = await vapi.getMatches({
            region: 'br',
            name: name.trim(),
            tag: tag.trim(),
            filter: 'competitive',
            size: 20
        });

        if (!matches.data || !Array.isArray(matches.data)) {
            return res.send("Nenhuma partida encontrada ou erro na API.");
        }

        const hojeBrasil = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        
        // Vamos montar uma lista em texto para ver no navegador exatamente o que está acontecendo
        let respostaDiagnostico = `DATA DE HOJE NO BOT: ${hojeBrasil}\n\n`;
        respostaDiagnostico += `LISTA DE PARTIDAS RECEBIDAS DA API:\n`;
        respostaDiagnostico += `=====================================\n`;

        matches.data.forEach((match, index) => {
            const dataPartidaBrasil = new Date(match.metadata.game_start * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const horaPartidaBrasil = new Date(match.metadata.game_start * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            const modoJogo = match.metadata.mode;
            const mapa = match.metadata.map;

            // Encontra se o jogador venceu ou perdeu
            const player = match.players.all_players.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
            let resultado = "Não encontrado";
            if (player) {
                const playerTeam = player.team.toLowerCase();
                if (match.teams[playerTeam]) {
                    resultado = match.teams[playerTeam].has_won ? "VITÓRIA" : "DERROTA";
                }
            }

            respostaDiagnostico += `[Jogo ${index + 1}] Mapa: ${mapa} | Modo: ${modoJogo} | Data: ${dataPartidaBrasil} às ${horaPartidaBrasil} | Resultado: ${resultado}\n`;
        });

        // Altera o cabeçalho para o navegador exibir quebras de linha bonitinhas (\n)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(respostaDiagnostico);

    } catch (error) {
        return res.send(`Erro no diagnóstico: ${error.message}`);
    }
});

module.exports = router;