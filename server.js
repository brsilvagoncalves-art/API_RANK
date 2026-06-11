const express = require('express');
const app = express();
const rankRoute = require('./routes/rank');

const PORT = process.env.PORT || 3000;

// Middlawere para permitir que o JSON seja lido
app.use(express.json());

// Rota principal para o comando de rank
app.use('/api', rankRoute);

// Rota para teste
app.get('/', (req, res) => {
    res.send('API de Rank para Nightbot está funcionando!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});