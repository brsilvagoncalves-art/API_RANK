const express = require('express');
const axios = require('axios');
const HenrikDevValorantAPI = require('unofficial-valorant-api');

const router = express.Router();
const KEY = process.env.HENRIK_ADVANCE_KEY;
const vapi = new HenrikDevValorantAPI(KEY);

if (!KEY) console.warn('AVISO: HENRIK_ADVANCE_KEY não está definida.');

const FRESH_MS = 60_000;        // cache "novo"
const STALE_MS = 10 * 60_000;   // até quando serve cache velho se a API falhar
const MAX_ENTRIES = 500;
const TIMEOUT_MS = 6_000;

const cache = new Map();    // chave -> { data, ts }
const inflight = new Map(); // chave -> Promise (evita chamadas duplicadas)

// Limpa entradas velhas a cada minuto
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of cache) if (now - v.ts > STALE_MS) cache.delete(k);
}, 60_000).unref();

function saveCache(key, data) {
    cache.delete(key);
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { data, ts: Date.now() });
}

function withTimeout(promise, ms) {
    let t;
    const timeout = new Promise((_, reject) => {
        t = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

const NAME_RE = /^[\p{L}\p{N} _.\-]{3,16}$/u;
const TAG_RE = /^[\p{L}\p{N}]{3,5}$/u;

const TRADUCOES = {
    Iron: 'Ferro', Silver: 'Prata', Gold: 'Ouro', Platinum: 'Platina',
    Diamond: 'Diamante', Ascendant: 'Ascendente', Immortal: 'Imortal', Radiant: 'Radiante'
};
const traduzir = (rank) =>
    rank.replace(/Iron|Silver|Gold|Platinum|Diamond|Ascendant|Immortal|Radiant/, (m) => TRADUCOES[m]);

// Histórico do dia (placar V/D). Retorna null se falhar, nunca derruba a requisição.
async function fetchHistorico(name, tag) {
    try {
        const url = `https://api.henrikdev.xyz/valorant/v1/lifetime/matches/br/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=competitive&size=25`;
        const { data } = await axios.get(url, {
            headers: { Authorization: KEY },
            timeout: TIMEOUT_MS
        });

        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        let vitorias = 0, derrotas = 0;

        for (const match of data.data || []) {
            const dia = new Date(match.meta.started_at)
                .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
            if (dia !== hoje) continue;

            const meu = match.stats.team.toLowerCase();
            const inimigo = meu === 'red' ? 'blue' : 'red';
            const a = match.teams[meu], b = match.teams[inimigo];
            if (a > b) vitorias++;
            else if (b > a) derrotas++;
        }
        return { vitorias, derrotas };
    } catch (err) {
        console.log('Erro na API Lifetime:', err.message);
        return null;
    }
}

async function fetchRank(name, tag) {
    // As duas chamadas rodam em paralelo
    const [mmr, historico] = await Promise.all([
        withTimeout(vapi.getMMR({ version: 'v2', region: 'br', name, tag }), TIMEOUT_MS),
        fetchHistorico(name, tag)
    ]);

    if (mmr?.status === 429) throw Object.assign(new Error('rate limit'), { code: 'RATE' });

    const atual = mmr?.data?.current_data;
    if (mmr?.error || !atual?.currenttierpatched) {
        throw Object.assign(new Error('sem dados competitivos'), { code: 'NOTFOUND' });
    }

    return {
        rank: atual.currenttierpatched,
        rr: atual.ranking_in_tier,
        name: mmr.data.name,
        tag: mmr.data.tag,
        historico
    };
}

function montarTexto(d) {
    const hist = d.historico
        ? `Histórico de Hoje: ${d.historico.vitorias}V / ${d.historico.derrotas}D`
        : 'Histórico de hoje indisponível';
    return `[VALORANT] ${d.name}#${d.tag} | Rank: ${traduzir(d.rank)} (${d.rr} RR) | ${hist}`;
}

router.get('/valorant', async (req, res) => {
    res.type('text');
    const { name, tag } = req.query;

    if (typeof name !== 'string' || typeof tag !== 'string') {
        return res.send('[VALORANT] Informe o nome e a tag. Ex: ?name=NOME&tag=TAG');
    }

    const cleanName = name.trim();
    const cleanTag = tag.trim().replace(/^#/, '');

    if (!NAME_RE.test(cleanName) || !TAG_RE.test(cleanTag)) {
        return res.send('[VALORANT] Nick ou tag em formato inválido.');
    }

    const key = `br-${cleanName.toLowerCase()}-${cleanTag.toLowerCase()}`;
    const cached = cache.get(key);

    // 1) Cache novo
    if (cached && Date.now() - cached.ts < FRESH_MS) {
        return res.send(montarTexto(cached.data));
    }

    try {
        // 2) Junta quem pediu o mesmo nick ao mesmo tempo em uma única busca
        let promise = inflight.get(key);
        if (!promise) {
            promise = fetchRank(cleanName, cleanTag)
                .then((data) => { saveCache(key, data); return data; })
                .finally(() => inflight.delete(key));
            inflight.set(key, promise);
        }
        const data = await promise;
        return res.send(montarTexto(data));
    } catch (err) {
        console.log('Erro geral:', err.code || '', err.message);

        // 3) API falhou: serve o último valor conhecido, se existir
        if (cached && Date.now() - cached.ts < STALE_MS) {
            return res.send(montarTexto(cached.data));
        }

        if (err.code === 'TIMEOUT') return res.send('[VALORANT] A API demorou demais. Tente de novo.');
        if (err.code === 'RATE') return res.send('[VALORANT] API sobrecarregada. Tente em instantes.');
        return res.send('[VALORANT] Erro ao carregar elo. Verifique se o Nick/Tag estão corretos.');
    }
});

module.exports = router;