
const express = require("express");
const router = express.Router();
const repertoireController = require('../controllers/historicoController');
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.post("/", repertoireController.createRepertoire);
router.get("/", repertoireController.getAllRepertoires);
router.get("/:id", repertoireController.getRepertoireById);
router.get("/event/:eventId", repertoireController.getRepertoireByEventId);
router.patch("/:id", repertoireController.updateRepertoire);
router.delete("/:id", repertoireController.deleteRepertoire);

module.exports = router;
