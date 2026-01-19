// src/middleware/limitsGuard.js
const { getEntitlementsFor } = require('../utils/entitlements');
const Event = require('../models/Event'); // usado em operações de evento (contagem e inspeção)

function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function coerceDate(v, fallback = new Date()) {
  try {
    const d = v ? new Date(v) : fallback;
    if (isNaN(d.getTime())) return fallback;
    return d;
  } catch {
    return fallback;
  }
}

/**
 * limitsGuard(operation: string)
 *
 * Exemplos de operation:
 *  - 'event:create'
 *  - 'event:update'
 *  - 'event:add-song'
 *  - 'event:duplicate'
 *  - 'team:create'
 *  - 'attachments:upload'
 */
module.exports = function limitsGuard(operation) {
  return async function limitsGuardMiddleware(req, res, next) {
    try {
      const org = req._org || {};
      const ent = req.entitlements || getEntitlementsFor(org);
      req.entitlements = ent; // garante disponibilidade adiante

      console.log('[limitsGuard] op=', operation, {
        orgId: req.orgId,
        plan: ent?.plan,
        writeMode: ent?.write?.mode,
        horizon: ent?.limits?.planningHorizonDays,
        perMonth: ent?.limits?.eventsPerMonth,
        bodyDate: req.body?.date,
        paramsId: req.params?.id,
      });


      // Se plano/entitlements liberam completamente escrita, não há limites a aplicar.
      // 'limited' => aplicar; 'full' => seguir; 'blocked' já foi tratado no licenseGuard.
      const writeMode = ent?.write?.mode || 'full';

      console.log('[limitsGuard] writeMode=', writeMode, '| willApplyLimits=', writeMode === 'limited');

      if (writeMode !== 'limited') return next();

      // Mapa de operações
      switch (operation) {
        // ========================
        // EVENTOS
        // ========================
        case 'event:create': {
          const limits = ent.limits || {};
          const limitPerMonth = limits.eventsPerMonth ?? null;
          const horizonDays = limits.planningHorizonDays ?? null;

          // Planning horizon (data futura máxima)
          if (horizonDays != null) {
            const now = new Date();
            const maxDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
            const evtDate = coerceDate(req.body?.date, now);
            if (evtDate.getTime() > maxDate.getTime()) {
              return res.status(422).json({
                error: 'LIMIT_REACHED',
                limit: 'planningHorizonDays',
                plan: ent.plan,
                allowed: horizonDays,
              });
            }
          }

          // Events per month (contagem na org, no mês da data do evento)
          if (limitPerMonth != null) {
            const referenceDate = coerceDate(req.body?.date, new Date());
            const from = startOfMonth(referenceDate);
            const to = endOfMonth(referenceDate);

            const count = await Event.countDocuments({
              org: req.orgId,
              date: { $gte: from, $lt: to },
            });

            if (count >= limitPerMonth) {
              return res.status(422).json({
                error: 'LIMIT_REACHED',
                limit: 'eventsPerMonth',
                plan: ent.plan,
                allowed: limitPerMonth,
              });
            }
          }

          return next();
        }

        case 'event:update': {
          const limits = ent.limits || {};
          const limitPerMonth = limits.eventsPerMonth ?? null;
          const horizonDays = limits.planningHorizonDays ?? null;

          const eventId =
            req.params?.id ||
            req.params?.eventId ||
            req.body?.eventId ||
            req.body?.event;

          // Se não conseguimos identificar o evento, deixa o controller validar
          if (!eventId) return next();

          // Busca evento atual para comparar datas (e manter org scope)
          const current = await Event.findOne({ _id: eventId, org: req.orgId })
            .select('date')
            .lean();

          if (!current) return next(); // 404 tratado no controller

          const currentDate = coerceDate(current.date, new Date());

          // Se o front não está alterando a data, não há como burlar horizon/perMonth
          if (typeof req.body?.date === 'undefined' || req.body?.date === null) {
            return next();
          }

          const targetDate = coerceDate(req.body.date, currentDate);

          // 1) Planning horizon (data futura máxima)
          if (horizonDays != null) {
            const now = new Date();
            const maxDate = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);

            if (targetDate.getTime() > maxDate.getTime()) {
              return res.status(422).json({
                error: 'LIMIT_REACHED',
                limit: 'planningHorizonDays',
                plan: ent.plan,
                allowed: horizonDays,
              });
            }
          }

          // 2) Events per month (no mês da data alvo) — exclui o próprio evento
          if (limitPerMonth != null) {
            const from = startOfMonth(targetDate);
            const to = endOfMonth(targetDate);

            console.log('[limitsGuard:event:update] perMonth-check', {
              orgId: req.orgId,
              eventId,
              limitPerMonth,
              targetDate: targetDate?.toISOString?.() || String(targetDate),
              from: from?.toISOString?.() || String(from),
              to: to?.toISOString?.() || String(to),
            });

            const count = await Event.countDocuments({
              org: req.orgId,
              _id: { $ne: eventId },
              date: { $gte: from, $lt: to },
            });

            console.log('[limitsGuard:event:update] perMonth-count', {
              count,
              limitPerMonth,
              willBlock: count >= limitPerMonth,
            });

            if (count >= limitPerMonth) {
              return res.status(422).json({
                error: 'LIMIT_REACHED',
                limit: 'eventsPerMonth',
                plan: ent.plan,
                allowed: limitPerMonth,
              });
            }
          }

          return next();
        }


        case 'event:add-song': {
          const limits = ent.limits || {};
          const songsPerEvent = limits.songsPerEvent ?? null;
          if (songsPerEvent == null) return next(); // ilimitado

          // Identifica o evento alvo
          const eventId =
            req.params?.eventId ||
            req.params?.id ||
            req.body?.event ||
            req.body?.eventId;

          if (!eventId) return next(); // sem ID não conseguimos contar; deixa controller validar

          // Busca evento restrito à org
          const evt = await Event.findOne({ _id: eventId, org: req.orgId })
            .select('songs repertoire attachments')
            .lean();

          if (!evt) return next(); // 404 será tratado no controller

          // Heurística para contar músicas (compatível com diferentes estruturas)
          let currentSongs = 0;
          if (Array.isArray(evt.songs)) currentSongs = evt.songs.length;
          else if (Array.isArray(evt.repertoire)) currentSongs = evt.repertoire.length;
          else if (evt.repertoire && Array.isArray(evt.repertoire?.songs))
            currentSongs = evt.repertoire.songs.length;

          // Se já está no limite, bloquear a adição
          if (currentSongs >= songsPerEvent) {
            return res.status(422).json({
              error: 'LIMIT_REACHED',
              limit: 'songsPerEvent',
              plan: ent.plan,
              allowed: songsPerEvent,
            });
          }

          return next();
        }

        case 'event:duplicate': {
          const canDuplicate = ent.features?.duplicateEvent === true;
          if (!canDuplicate) {
            return res.status(403).json({
              error: 'FEATURE_LOCKED',
              feature: 'duplicateEvent',
              plan: ent.plan,
            });
          }
          return next();
        }

        // ========================
        // TIMES (TEAMS)
        // ========================
        case 'team:create': {
          const teamsFeature = ent.features?.teams !== false; // por padrão true no FREE/PRO/PLUS
          if (!teamsFeature) {
            return res.status(403).json({
              error: 'FEATURE_LOCKED',
              feature: 'teams',
              plan: ent.plan,
            });
          }
          return next();
        }

        // ========================
        // ANEXOS (ATTACHMENTS)
        // ========================
        case 'attachments:upload': {
          const limits = ent.limits || {};
          const perEvent = limits.attachmentsPerEvent ?? null;
          if (perEvent == null) return next(); // ilimitado

          const eventId =
            req.params?.eventId ||
            req.params?.id ||
            req.body?.event ||
            req.body?.eventId;

          if (!eventId) return next(); // sem ID, deixa controller validar

          const evt = await Event.findOne({ _id: eventId, org: req.orgId })
            .select('attachments')
            .lean();

          if (!evt) return next();

          const current = Array.isArray(evt.attachments) ? evt.attachments.length : 0;
          if (current >= perEvent) {
            return res.status(422).json({
              error: 'LIMIT_REACHED',
              limit: 'attachmentsPerEvent',
              plan: ent.plan,
              allowed: perEvent,
            });
          }
          return next();
        }

        // ========================
        // DEFAULT: nenhuma regra aplicada
        // ========================
        default:
          return next();
      }
    } catch (err) {
      console.error('[limitsGuard] erro:', err);
      return res.status(500).json({ error: 'LIMITS_GUARD_ERROR' });
    }
  };
};
