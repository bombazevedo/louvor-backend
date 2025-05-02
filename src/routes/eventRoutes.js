const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const authMiddleware = require("../middleware/auth"); // Assuming auth middleware exists for protected routes

// Aplicar middleware de autenticação a todas as rotas de eventos (ou às específicas que precisam)
// router.use(authMiddleware); // Descomente se todas as rotas de evento exigirem login

// Criar novo evento (POST /api/events)
// Potencialmente proteger esta rota para que apenas usuários autorizados possam criar eventos
router.post("/", authMiddleware, eventController.createEvent);

// Listar todos os eventos (GET /api/events)
// Geralmente pública ou requer apenas login básico
router.get("/", authMiddleware, eventController.getAllEvents);

// Buscar evento por ID (GET /api/events/:id)
// Geralmente pública ou requer apenas login básico
router.get("/:id", authMiddleware, eventController.getEventById);

// Atualizar evento por ID (PATCH /api/events/:id)
// Proteger esta rota para que apenas usuários autorizados (ex: coordenador, DM, criador) possam atualizar
router.patch("/:id", authMiddleware, eventController.updateEvent); // Adicionar verificação de role dentro do controller ou middleware específico

// Deletar evento por ID (DELETE /api/events/:id)
// Proteger esta rota para que apenas usuários autorizados possam deletar
router.delete("/:id", authMiddleware, eventController.deleteEvent); // Adicionar verificação de role dentro do controller ou middleware específico

module.exports = router;

