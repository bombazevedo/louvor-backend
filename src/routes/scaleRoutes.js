const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const {
  createScale,
  updateScale,
  getScaleByEventId,
  deleteScale,
  getAllScales,
  getScaleById
} = require('../controllers/scaleController');

router.use(authenticate);
router.get('/', getAllScales);
router.get('/:id', getScaleById);
router.get('/event/:eventId', getScaleByEventId);
router.post('/', createScale);
router.patch('/:id', updateScale);
router.delete('/:id', deleteScale);

module.exports = router;
