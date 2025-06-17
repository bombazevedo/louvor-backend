const express = require('express');
const {
  createUnavailability,
  deleteUnavailability,
  getMyUnavailability,
  getUnavailabilityByDate,
} = require('../controllers/unavailabilityController');
const { authenticate } = require('../middleware/auth'); // ✔️ Correção aqui

const router = express.Router();

router.use(authenticate); // ✔️ Middleware correto

router.post('/', createUnavailability);
router.get('/mine', getMyUnavailability);
router.delete('/:id', deleteUnavailability);
router.get('/by-date/:date', getUnavailabilityByDate);

module.exports = router;
