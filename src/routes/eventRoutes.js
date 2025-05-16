
const express = require('express');
const router = express.Router();

// ✅ Rota de teste simples para verificar se o servidor sobe corretamente
router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor respondeu com sucesso.' });
});

router.get('/:id', (req, res) => {
  res.json({ status: 'ok', eventId: req.params.id });
});

module.exports = router;
