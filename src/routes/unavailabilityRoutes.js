import express from 'express';
import {
  createUnavailability,
  deleteUnavailability,
  getMyUnavailability,
  getUnavailabilityByDate,
} from '../controllers/unavailabilityController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.use(auth); // Protege todas as rotas

router.post('/', createUnavailability);                 // Criar
router.get('/mine', getMyUnavailability);               // Listar minhas
router.delete('/:id', deleteUnavailability);            // Deletar
router.get('/by-date/:date', getUnavailabilityByDate);  // Checar quem está indisponível na data

export default router;
