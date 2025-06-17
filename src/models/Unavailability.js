const express = require('express');
const {
  createUnavailability,
  deleteUnavailability,
  getMyUnavailability,
  getUnavailabilityByDate,
} = require('../controllers/unavailabilityController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth); // Protege todas as rotas

router.post('/', createUnavailability);                 // Criar
router.get('/mine', getMyUnavailability);               // Listar minhas
router.delete('/:id', deleteUnavailability);            // Deletar
router.get('/by-date/:date', getUnavailabilityByDate);  // Checar quem está indisponível na data

module.exports = router;
