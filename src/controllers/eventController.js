const Event = require('../models/Event');
const Scale = require('../models/Scale');
const Song = require('../models/Song');
const { normalizeMusicUrl } = require('../utils/normalizeMusicUrl');

// --- Firebase Admin para Firestore ---
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const firestoreDb = admin.firestore();

// --- Função utilitária para limpar objetos mongoose
function clean(obj) {
  if (!obj) return obj;
  if (typeof obj.toObject === 'function') obj = obj.toObject();
  const keysToRemove = ['__parentArray', '__index', '$__parent', '$__', '_doc', '$isNew'];
  for (const key of keysToRemove) delete obj[key];
  for (const k in obj) {
    if (Array.isArray(obj[k])) obj[k] = obj[k].map(clean);
    else if (obj[k] && typeof obj[k] === 'object') obj[k] = clean(obj[k]);
  }
  return obj;
}

// Buscar todos os eventos com escala e detalhes das músicas
const getEventsWithScales = async (req, res) => {
  try {
    const events = await Event.find()
      .sort({ date: 1 })
      .populate('musicLinks.song')
      .lean();

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate('members.user')
          .populate('members.function')
          .lean();

        let cleanedScale = scale ? clean(scale) : null;

        const enrichedMusicLinks = (event.musicLinks || []).map(m => {
          let song = m.song && typeof m.song === 'object' ? clean(m.song) : null;
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

// Buscar evento por ID com escala e detalhes das músicas
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('musicLinks.song')
      .lean();

    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const scale = await Scale.findOne({ eventId: event._id })
      .populate('members.user')
      .populate('members.function')
      .lean();

    let cleanedScale = scale ? clean(scale) : null;

    const enrichedMusicLinks = (event.musicLinks || []).map(m => {
      let song = m.song && typeof m.song === 'object' ? clean(m.song) : null;
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

// Criar evento com salvamento automático do Song + sincronização com Firestore
const createEvent = async (req, res) => {
  try {
    const { title, description, date, location, type, musicLinks } = req.body;

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
          if (link.platform === 'YouTube') {
            songData.youtubeUrl = normalizedUrl;
          }
          if (link.platform === 'Spotify') {
            songData.spotifyUrl = normalizedUrl;
          }
          if (link.platform === 'Deezer') {
            songData.deezerUrl = normalizedUrl;
          }
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

    const newEvent = new Event({
      title,
      description,
      date,
      location,
      type,
      musicLinks: normalizedMusicLinks
    });

    const savedEvent = await newEvent.save();

    try {
      await firestoreDb.collection('events').doc(savedEvent._id.toString()).set({
        title: savedEvent.title,
        description: savedEvent.description || '',
        date: savedEvent.date || null,
        location: savedEvent.location || '',
        type: savedEvent.type || '',
        createdAt: new Date()
      });
      console.log(`[Firestore] Evento ${savedEvent._id} sincronizado com sucesso`);
    } catch (fireErr) {
      console.error('[Firestore] Erro ao sincronizar evento:', fireErr);
    }

    res.status(201).json(clean(savedEvent));
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro ao criar evento' });
  }
};

// Atualizar evento com suporte à paleta de cores
const updateEvent = async (req, res) => {
  try {
    const { title, description, date, location, type, musicLinks, colorPalette } = req.body;

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
          if (link.platform === 'Deezer') songData.deezerUrl = normalizedUrl;
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

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        date,
        location,
        type,
        musicLinks: normalizedMusicLinks,
        colorPalette: Array.isArray(colorPalette) ? colorPalette : []
      },
      { new: true }
    );

    res.json(clean(updatedEvent));
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ message: 'Erro ao atualizar evento' });
  }
};

module.exports = {
  getEventsWithScales,
  getEventById,
  createEvent,
  updateEvent
};
