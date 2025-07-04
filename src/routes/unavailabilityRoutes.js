const express = require('express');
const {
  createUnavailability,
  deleteUnavailability,
  getMyUnavailability,
  getUnavailabilityByDate,
  getUnavailabilityByUser // ✅ Nova função importada
} = require('../controllers/unavailabilityController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', createUnavailability);
router.get('/mine', getMyUnavailability);
router.get('/by-date/:date', getUnavailabilityByDate);
router.get('/user/:userId', getUnavailabilityByUser); // ✅ Nova rota
router.delete('/:id', deleteUnavailability);

module.exports = router;
