
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const notificationController = require("../controllers/notificationController");

router.use(authenticate);

router.get("/", notificationController.getAllNotifications);
router.get("/:id", notificationController.getNotificationById);
router.post("/", notificationController.createNotification);
router.patch("/:id", notificationController.updateNotification);
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
