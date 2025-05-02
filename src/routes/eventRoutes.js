const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const authMiddleware = require("../middleware/auth");

// Criar novo evento (POST /api/events)
router.post("/", authMiddleware, eventController.createEvent);

// Listar todos os eventos (GET /api/events)
router.get("/", authMiddleware, eventController.getAllEvents);

// Buscar evento por ID (GET /api/events/:id)
router.get("/:id", authMiddleware, eventController.getEventById);

// Atualizar evento por ID (PATCH /api/events/:id)
router.patch("/:id", authMiddleware, eventController.updateEvent);

// Deletar evento por ID (DELETE /api/events/:id)
router.delete("/:id", authMiddleware, eventController.deleteEvent);

module.exports = router;
