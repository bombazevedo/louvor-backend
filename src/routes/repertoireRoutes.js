
const express = require("express");
const router = express.Router();
const repertoireController = require('../controllers/repertoireController');
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/event/:eventId", repertoireController.getRepertoireByEventId);
router.get("/:id", repertoireController.getRepertoireById);

router.post("/", repertoireController.createRepertoire);
router.get("/", repertoireController.getAllRepertoires);
router.patch("/:id", repertoireController.updateRepertoire);
router.delete("/:id", repertoireController.deleteRepertoire);

module.exports = router;
