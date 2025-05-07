const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");

const {
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent
} = require("../controllers/eventController");

// Rotas protegidas por autenticação
router.get("/", authenticate, getEvents);
router.get("/:id", authenticate, getEventById);
router.patch("/:id", authenticate, updateEvent);
router.delete("/:id", authenticate, deleteEvent);

module.exports = router;
