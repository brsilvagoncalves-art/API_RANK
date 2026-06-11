const express = require('express');
const app = express();
//const cors = require('cors');
const rankRoute = require('./routes/rank'); // Ajuste o caminho se seu arquivo for rank.js

app.use(express.json());
//app.use(cors());

// VINCULAÇÃO CORRETA: Deixa a sub-rota cuidar do mapeamento do '/valorant'
app.use('/api', rankRoute);

// Rota padrão para caso digitem algo completamente errado na raiz
app.use((req, res) => {
    res.status(404).send('[VALORANT] Rota inválida. Use /api/valorant?name=NOME&tag=TAG');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});