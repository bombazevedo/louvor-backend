// controllers/notification.controller.js
const Notification = require('../models/Notification');

// Lista as notificações do usuário autenticado
exports.listMine = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const docs = await Notification
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(docs);
  } catch (err) { return next(err); }
};

// Cria e (opcionalmente) envia push. Útil quando seu backend quiser disparar e já persistir.
exports.create = async (req, res, next) => {
  try {
    const {
      userId,
      title,
      message,
      type,
      relatedModel, // vinda do front
      relatedId,    // vinda do front
      metadata      // vinda do front
    } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ message: 'userId e message são obrigatórios' });
    }

    // Mapear para os campos do schema (user/referenceModel/reference/data)
    const doc = await Notification.create({
      user: userId,
      title: title || 'Notificação',
      message,
      type,
      referenceModel: relatedModel,
      reference: relatedId,
      data: metadata
    });

    // Se quiser integrar com FCM no backend no futuro, chame um serviço aqui (firebase-admin)
    // await pushService.sendToUser(userId, { title: title || 'Notificação', body: message, data: {...} });

    return res.status(201).json(doc);
  } catch (err) { return next(err); }
};

// Marca uma notificação como lida
exports.markOneRead = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { id } = req.params;

    const doc = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { read: true } },
      { new: true }
    ).lean();

    if (!doc) return res.status(404).json({ message: 'Notificação não encontrada' });
    return res.json(doc);
  } catch (err) { return next(err); }
};

// Marca todas como lidas
exports.markAllRead = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const r = await Notification.updateMany(
      { user: userId, read: false },
      { $set: { read: true } }
    );
    return res.json({ matched: r.matchedCount ?? r.n, modified: r.modifiedCount ?? r.nModified });
  } catch (err) { return next(err); }
};

// Exclui uma notificação
exports.removeOne = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { id } = req.params;

    const r = await Notification.deleteOne({ _id: id, user: userId });
    if ((r.deletedCount ?? r.n) === 0) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }
    return res.status(204).send();
  } catch (err) { return next(err); }
};
