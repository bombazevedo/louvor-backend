
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const chatController = require("../controllers/chatController");

router.use(authenticate);

router.post("/", chatController.createChat);
router.get("/", chatController.getAllChats);
router.get("/:id", chatController.getChatById);
router.delete("/:id", chatController.deleteChat);

module.exports = router;
