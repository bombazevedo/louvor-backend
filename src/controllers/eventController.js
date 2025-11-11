const Event = require('../models/Event'); // ✅ correção: linha descomentada
const Scale = require('../models/Scale');
const Song = require('../models/Song');
const { normalizeMusicUrl } = require('../utils/normalizeMusicUrl');

// ⬇️ [INSERÇÃO] Push agregado (chat/evento)
const pushService = require('../services/pushService');

// --- Firebase Admin para Firestore ---
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

if (!admin.apps.length && serviceAccount && Object.keys(serviceAccount).length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const firestoreDb = admin.apps.length ? admin.firestore() : null;

// Utilitário simples para serializar documentos (remove metadados do Mongoose)
const clean = (doc) => JSON.parse(JSON.stringify(doc || {}));

// ⬇️ [INSERÇÃO] helper local para IDs de usuários da escala
const pickMemberUserIds = (scaleDoc) => {
  const arr = Array.isArray(scaleDoc?.members) ? scaleDoc.members : [];
  return [...new Set(arr.map(m => String(m?.user?._id || m?.user || '')).filter(Boolean))];
};

/**
 * GET /events
 * Retorna eventos com escala e musicLinks enriquecidos.
 */
const getEventsWithScales = async (req, res) => {
  try {
    const events = await Event.find({ org: req.orgId }).populate('musicLinks.song').lean();

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate('members.user')
          .populate('members.function')
          .lean();

        const cleanedScale = scale ? clean(scale) : null;

        const enrichedMusicLinks = (event.musicLinks || []).map((m) => {
          const song = m.song && typeof m.song === 'object' ? clean(m.song) : null;
          return {
            ...m,
            song: song ? song._id : m.song,
            name: song?.title || m.name || '',
            artist: song?.artist || m.artist || '',
            coverUrl: song?.coverUrl || m.coverUrl || '',
            bpm: song?.bpm || null,
            key: song?.key || null,
            duration: song?.duration || null,
            spotifyUrl: song?.spotifyUrl || null,
            deezerUrl: song?.deezerUrl || null,
            youtubeUrl: song?.youtubeUrl || null,
            ...((song) ? {} : m)
          };
        });

        return {
          ...clean(event),
          scale: cleanedScale,
          musicLinks: enrichedMusicLinks
        };
      })
    );

    res.json(eventsWithScales);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ message: 'Erro ao buscar eventos' });
  }
};

/**
 * GET /events/:id
 * Retorna um evento com escala e musicLinks enriquecidos.
 */
const getEventById = async (req, res) => {
  try {
    const event = await Event.findOne({ _id: req.params.id, org: req.orgId })
      .populate('musicLinks.song')
      .lean();

    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const scale = await Scale.findOne({ eventId: event._id })
      .populate('members.user')
      .populate('members.function')
      .lean();

    const cleanedScale = scale ? clean(scale) : null;

    const enrichedMusicLinks = (event.musicLinks || []).map((m) => {
      const song = m.song && typeof m.song === 'object' ? clean(m.song) : null;
      return {
        ...m,
        song: song ? song._id : m.song,
        name: song?.title || m.name || '',
        artist: song?.artist || m.artist || '',
        coverUrl: song?.coverUrl || m.coverUrl || '',
        bpm: song?.bpm || null,
        key: song?.key || null,
        duration: song?.duration || null,
        spotifyUrl: song?.spotifyUrl || null,
        deezerUrl: song?.deezerUrl || null,
        youtubeUrl: song?.youtubeUrl || null,
        ...((song) ? {} : m)
      };
    });

    res.json({
      ...clean(event),
      scale: cleanedScale,
      musicLinks: enrichedMusicLinks
    });
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento' });
  }
};

/**
 * POST /events
 * Cria evento (normaliza musicLinks, salva paleta e sincroniza no Firestore).
 */
const createEvent = async (req, res) => {
  try {
    const {
  title, description, date, location, type,
  musicLinks,
  colorPalette, primaryColor,
  paletteMode, showFullPalette,
  attachments, // ⬅️ ✅ (adição cirúrgica) incluir anexos do front
  dnNotes      // ⬅️ 📝 novo: Anotações do DM
} = req.body;

    const normalizedMusicLinks = [];

    if (musicLinks && Array.isArray(musicLinks)) {
      for (const link of musicLinks) {
        const normalizedUrl = normalizeMusicUrl(link.url, link.platform);

        const existing = await Song.findOne({
          $or: [
            { youtubeUrl: normalizedUrl },
            { spotifyUrl: normalizedUrl },
            { deezerUrl: normalizedUrl }
          ]
        });

        let songId = null;

        if (existing) {
          songId = existing._id;
        } else {
          const songData = {
            title: link.name || 'Sem título',
            artist: link.artist || 'Desconhecido',
            coverUrl: link.thumbnail || '',
          };
          if (link.platform === 'YouTube') songData.youtubeUrl = normalizedUrl;
          if (link.platform === 'Spotify') songData.spotifyUrl = normalizedUrl;
          if (link.platform === 'Deezer')  songData.deezerUrl  = normalizedUrl;
          const created = await Song.create(songData);
          songId = created._id;
        }

        normalizedMusicLinks.push({
          name: link.name || (existing?.title || 'Sem título'),
          artist: link.artist || (existing?.artist || 'Desconhecido'),
          platform: link.platform,
          url: normalizedUrl,
          thumbnail: link.thumbnail || (existing?.coverUrl || ''),
          song: songId
        });
      }
    }

    // ⬇️ ✅ (adição cirúrgica) normalização mínima de anexos
    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .filter(Boolean)
          .map(a => ({
            name: a?.name || 'Arquivo',
            url: a?.url || a?.uri || '',
            public_id: a?.public_id || undefined
          }))
      : [];

    // Consistência entre paletteMode e showFullPalette
    const resolvedPaletteMode =
      paletteMode === 'mono' || paletteMode === 'full'
        ? paletteMode
        : (typeof showFullPalette === 'boolean' ? (showFullPalette ? 'full' : 'mono') : 'full');
    const resolvedShowFull = typeof showFullPalette === 'boolean'
      ? showFullPalette
      : (resolvedPaletteMode === 'full');

    const newEvent = new Event({
    org: req.orgId,
      title,
      description,
      date,
      location,
      type,
  dnNotes: (typeof dnNotes === 'string') ? dnNotes : '',
      musicLinks: normalizedMusicLinks,
      primaryColor: (typeof primaryColor === 'string') ? primaryColor : null,
      colorPalette: Array.isArray(colorPalette) ? colorPalette : [],
      paletteMode: resolvedPaletteMode,
      showFullPalette: resolvedShowFull,
      attachments: normalizedAttachments // ⬅️ ✅ (adição cirúrgica) salva anexos no evento
    });

    const savedEvent = await newEvent.save();

    try {
      if (firestoreDb) {
        await firestoreDb.collection('events').doc(savedEvent._id.toString()).set({
          title: savedEvent.title,
          description: savedEvent.description || '',
          date: savedEvent.date || null,
          location: savedEvent.location || '',
          type: savedEvent.type || '',
          createdAt: new Date()
        });
        console.log(`[Firestore] Evento ${savedEvent._id} sincronizado com sucesso`);
      }
    } catch (fireErr) {
      console.error('[Firestore] Erro ao sincronizar evento:', fireErr);
    }

    res.status(201).json(clean(savedEvent));
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro ao criar evento' });
  }
};

/**
 * PUT /events/:id
 * Atualiza evento (normaliza musicLinks e persiste paleta/mode).
 */
const updateEvent = async (req, res) => {
  try {
    const {
  title, description, date, location, type,
  musicLinks,
  colorPalette, primaryColor,
  paletteMode, showFullPalette,
  attachments, // ⬅️ ✅ (adição cirúrgica) incluir anexos do front
  dnNotes      // ⬅️ 📝 novo: Anotações do DM
} = req.body;


    const normalizedMusicLinks = [];

    if (musicLinks && Array.isArray(musicLinks)) {
      for (const link of musicLinks) {
        const normalizedUrl = normalizeMusicUrl(link.url, link.platform);

        const existing = await Song.findOne({
          $or: [
            { youtubeUrl: normalizedUrl },
            { spotifyUrl: normalizedUrl },
            { deezerUrl: normalizedUrl }
          ]
        });

        let songId = null;

        if (existing) {
          songId = existing._id;
        } else {
          const songData = {
            title: link.name || 'Sem título',
            artist: link.artist || 'Desconhecido',
            coverUrl: link.thumbnail || '',
          };
          if (link.platform === 'YouTube') songData.youtubeUrl = normalizedUrl;
          if (link.platform === 'Spotify') songData.spotifyUrl = normalizedUrl;
          if (link.platform === 'Deezer')  songData.deezerUrl  = normalizedUrl;
          const created = await Song.create(songData);
          songId = created._id;
        }

        normalizedMusicLinks.push({
          name: link.name || (existing?.title || 'Sem título'),
          artist: link.artist || (existing?.artist || 'Desconhecido'),
          platform: link.platform,
          url: normalizedUrl,
          thumbnail: link.thumbnail || (existing?.coverUrl || ''),
          song: songId
        });
      }
    }

    const updateData = {
      title,
      description,
      date,
      location,
      type,
      musicLinks: normalizedMusicLinks,
      colorPalette: Array.isArray(colorPalette) ? colorPalette : []
    };

if (typeof dnNotes === 'string') updateData.dnNotes = dnNotes;

    if (typeof primaryColor === 'string') {
      updateData.primaryColor = primaryColor;
    }

    // 🔒 Persistência do modo (coordenador define e todos visualizam igual)
    if (paletteMode === 'mono' || paletteMode === 'full') {
      updateData.paletteMode = paletteMode;
      updateData.showFullPalette = (paletteMode === 'full');
    }
    if (typeof showFullPalette === 'boolean') {
      updateData.showFullPalette = showFullPalette;
      updateData.paletteMode = showFullPalette ? 'full' : 'mono';
    }

    // ⬇️ ✅ (adição cirúrgica) normalização e persistência dos anexos
    if (Array.isArray(attachments)) {
      updateData.attachments = attachments
        .filter(Boolean)
        .map(a => ({
          name: a?.name || 'Arquivo',
          url: a?.url || a?.uri || '',
          public_id: a?.public_id || undefined
        }));
    }

    const updatedEvent = await Event.findOneAndUpdate(
  { _id: req.params.id, org: req.orgId },
  updateData,
  { new: true }
);

// ⬇️ [INSERÇÃO] Disparo agregado de "evento atualizado"
try {
  const headerTz = req.get('X-TZ') || req.get('x-tz');
  const timeZone = headerTz || process.env.DEFAULT_TZ || 'America/Sao_Paulo';

  const scale = await Scale.findOne({ eventId: updatedEvent._id })
    .select('members.user')
    .populate('members.user', '_id')
    .lean();

  const recipients = pickMemberUserIds(scale);
  if (recipients.length) {
    // não bloqueante
    pushService.queueEventChange({ event: updatedEvent, recipients, timeZone }).catch(() => {});
  }
} catch (_) {}

res.json(clean(updatedEvent));

  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento' });
  }
};

/**
 * PATCH /events/:eventId/songs/:songId/overrides
 * Atualiza overrides (key, bpm, manualLink) da música no CONTEXTO do evento.
 * Regras:
 *  - Somente Coordenador/DM (ou DM escalado) podem editar.
 *  - manualLink = null remove o link manual do evento.
 */
const updateEventSongOverrides = async (req, res) => {
  try {
    const user = req.user;
    const allowed = ['coordinator', 'coordenador', 'dm', 'dm_escalado'];
    if (!user || !allowed.includes(String(user.role || '').toLowerCase())) {
      return res.status(403).json({ message: 'Apenas Coordenador/DM escalado podem editar overrides.' });
    }

    const { eventId, songId } = req.params;
    const { key, bpm, manualLink } = req.body; // todos opcionais

    const event = await Event.findOne({ _id: eventId, org: req.orgId });
    if (!event) return res.status(404).json({ message: 'Evento não encontrado.' });

    // Garante array de overrides
    event.songOverrides = Array.isArray(event.songOverrides) ? event.songOverrides : [];

    // Procura item existente para a música
    const idx = event.songOverrides.findIndex(i => String(i.song) === String(songId));
    if (idx === -1) {
      // cria novo item se necessário
      event.songOverrides.push({ song: songId, overrides: {} });
    }
    const item = event.songOverrides.find(i => String(i.song) === String(songId));
    item.overrides = item.overrides || {};

    if (typeof key === 'string' && key.trim()) item.overrides.key = key.trim();
    if (Number.isFinite(bpm)) item.overrides.bpm = bpm;

    if (manualLink === null) {
      // remoção explícita do link manual no contexto do evento
      item.overrides.manualLink = undefined;
    } else if (manualLink && typeof manualLink.url === 'string' && manualLink.url.trim()) {
      item.overrides.manualLink = {
        url: manualLink.url.trim(),
        addedBy: user._id,
        addedAt: new Date(),
        note: manualLink.note && String(manualLink.note).trim()
          ? String(manualLink.note).trim()
          : 'Link manual (escopo do evento)'
      };
    }

    await event.save();

// ⬇️ [INSERÇÃO] "evento atualizado" (overrides contam como alteração)
try {
  const headerTz = req.get('X-TZ') || req.get('x-tz');
  const timeZone = headerTz || process.env.DEFAULT_TZ || 'America/Sao_Paulo';

  const scale = await Scale.findOne({ eventId: event._id })
    .select('members.user')
    .populate('members.user', '_id')
    .lean();

  const recipients = pickMemberUserIds(scale);
  if (recipients.length) {
    pushService.queueEventChange({ event, recipients, timeZone }).catch(() => {});
  }
} catch (_) {}

return res.json({
  eventId,
  songId,
  overrides: clean(item.overrides)
});

  } catch (error) {
    console.error('Erro ao atualizar overrides do evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar overrides do evento' });
  }
};

module.exports = {
  getEventsWithScales,
  getEventById,
  createEvent,
  updateEvent,
  updateEventSongOverrides // ⬅️ ✅ ADIÇÃO CIRÚRGICA: export da função PATCH
};
