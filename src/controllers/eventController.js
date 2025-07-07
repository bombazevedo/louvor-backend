// src/controllers/eventController.js
const Event = require('../models/Event');
const Scale = require('../models/Scale');
const Song = require('../models/Song');
const { normalizeMusicUrl } = require('../utils/normalizeMusicUrl');

// Buscar todos os eventos com escala e detalhes das músicas
const getEventsWithScales = async (req, res) => {
  try {
    const events = await Event.find()
      .sort({ date: 1 })
      .populate('musicLinks.song');

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate('members.user')
          .populate('members.function');

        const enrichedMusicLinks = (event.musicLinks || []).map(m => {
          // Se veio populado, usa direto
          if (m.song && typeof m.song === 'object') {
            return {
              ...m,
              name: m.song.title,
              artist: m.song.artist,
              coverUrl: m.song.coverUrl
            };
          }
          return m;
        });

        const eventObj = event.toObject();
        eventObj.scale = scale;
        eventObj.musicLinks = enrichedMusicLinks;

        return eventObj;
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
      .populate('musicLinks.song');

    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const scale = await Scale.findOne({ eventId: event._id })
      .populate('members.user')
      .populate('members.function');

    const enrichedMusicLinks = (event.musicLinks || []).map(m => {
      if (m.song && typeof m.song === 'object') {
        return {
          ...m,
          name: m.song.title,
          artist: m.song.artist,
          coverUrl: m.song.coverUrl
        };
      }
      return m;
    });

    const eventObj = event.toObject();
    eventObj.scale = scale;
    eventObj.musicLinks = enrichedMusicLinks;

    res.json(eventObj);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ message: 'Erro ao buscar evento' });
  }
};

// Criar evento com salvamento automático do Song
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
    res.status(201).json(savedEvent);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ message: 'Erro ao criar evento' });
  }
};

module.exports = {
  getEventsWithScales,
  getEventById,
  createEvent
};
