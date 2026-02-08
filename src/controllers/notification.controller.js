// controllers/notification.controller.js
const Notification = require('../models/Notification');
// (NOVO) envio premium com prefs/quiet hours/badge
const { sendUserPush } = require('../services/pushService');

// Lista as notificações do usuário autenticado
exports.listMine = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;

        // (AJUSTE CIRÚRGICO) Suporte opcional a paginação (compatível com apiService: ?page&limit)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 0, 0); // 0 = sem paginação

    // ✅ multi-igrejas: se houver org ativa, filtra por org + fallback para antigas (org:null)
    const orgId = req.orgId || req.headers?.['x-org-id'] || null;

    const query = orgId
      ? { user: userId, $or: [{ org: orgId }, { org: null }] }
      : { user: userId };

    let q = Notification.find(query).sort({ createdAt: -1 }).lean();
    if (limit > 0) {
      q = q.skip((page - 1) * limit).limit(limit);
    }

    const docs = await q;
    return res.json(docs);
  } catch (err) { return next(err); }
};

// (NOVO) Contagem de não lidas — para badge no ícone
exports.unreadCount = async (req, res, next) => {
  try {
        const userId = req.userId || req.user?.id || req.user?._id;

    const orgId = req.orgId || req.headers?.['x-org-id'] || null;
    const query = orgId
      ? { user: userId, read: false, $or: [{ org: orgId }, { org: null }] }
      : { user: userId, read: false };

    const count = await Notification.countDocuments(query);
    return res.json({ unread: count });

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
      metadata,     // vinda do front
      pushNow,      // (NOVO) bool opcional: dispara push junto
      channel,      // (NOVO) ex.: 'scale' | 'eventReminder' | 'repertoire' | 'broadcast' | 'chat' | 'system'
      urgent        // (NOVO) bool opcional: fura quiet hours
    } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ message: 'userId e message são obrigatórios' });
    }

    // Mapear para os campos do schema (user/referenceModel/reference/data)
        const orgId = req.orgId || req.headers?.['x-org-id'] || null;

    const doc = await Notification.create({
      user: userId,

      // ✅ multi-igrejas: amarra a notificação à org ativa quando existir
      org: orgId || null,

      title: title || 'Notificação',
      message,
      type,
      referenceModel: relatedModel,
      reference: relatedId,
      data: metadata
    });

    // (NOVO) Disparo opcional de push junto com a persistência
    if (pushNow === true) {
      await sendUserPush(userId, {
        title: title || 'Notificação',
        body: message,
        data: {
          type: type || 'system',
          relatedModel: relatedModel || '',
          relatedId: relatedId || ''
        },
        channel: channel || 'system',
        urgent: !!urgent
      });
    }

    return res.status(201).json(doc);
  } catch (err) { return next(err); }
};

// Marca uma notificação como lida
exports.markOneRead = async (req, res, next) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const { id } = req.params;

        const orgId = req.orgId || req.headers?.['x-org-id'] || null;

    const filter = orgId
      ? { _id: id, user: userId, $or: [{ org: orgId }, { org: null }] }
      : { _id: id, user: userId };

    const doc = await Notification.findOneAndUpdate(
      filter,
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
        const orgId = req.orgId || req.headers?.['x-org-id'] || null;

    const filter = orgId
      ? { user: userId, read: false, $or: [{ org: orgId }, { org: null }] }
      : { user: userId, read: false };

    const r = await Notification.updateMany(
      filter,
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

        const orgId = req.orgId || req.headers?.['x-org-id'] || null;

    const filter = orgId
      ? { _id: id, user: userId, $or: [{ org: orgId }, { org: null }] }
      : { _id: id, user: userId };

    const r = await Notification.deleteOne(filter);

    if ((r.deletedCount ?? r.n) === 0) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }
    return res.status(204).send();
  } catch (err) { return next(err); }
};
