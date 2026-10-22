const express = require('express');
const rateLimit = require('express-rate-limit');
const rankRoute = require('./routes/rank');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // Render fica atrás de um proxy

// Health check leve, sem chamar API externa (para o UptimeRobot)
app.get('/health', (req, res) => {
    res.status(200).send('ok');
});

// Limite por IP. Folgado, porque Nightbot/StreamElements agrupam muita gente no mesmo IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).type('text').send('[VALORANT] Muitas requisições, tente em instantes.');
    }
});

app.use('/api', limiter, rankRoute);

// Rota inválida
app.use((req, res) => {
    res.status(404).type('text').send('[VALORANT] Rota inválida. Use /api/valorant?name=NOME&tag=TAG');
});

// Tratador global de erros: sempre texto curto, nunca stack trace
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).type('text').send('[VALORANT] Erro interno. Tente novamente.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});