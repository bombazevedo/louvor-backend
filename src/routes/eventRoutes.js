const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const {
  getEvents,
  updateEvent,
  deleteEvent
} = require("../controllers/eventController");

router.get("/", authenticate, getEvents);
router.patch("/:id", authenticate, updateEvent);
router.delete("/:id", authenticate, deleteEvent);

module.exports = router;

router.get('/:id', getEventById);
