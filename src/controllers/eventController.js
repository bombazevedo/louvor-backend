// src/controllers/eventController.js
const Event = require('../models/Event');
const Scale = require('../models/Scale');
const User = require('../models/User');
const Function = require('../models/BandRole');
const Song = require('../models/Song'); // 🔹 Importante: incluir Song

// Buscar todos os eventos com escala e detalhes das músicas
const getEventsWithScales = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });

    const eventsWithScales = await Promise.all(
      events.map(async (event) => {
        const scale = await Scale.findOne({ eventId: event._id })
          .populate('members.user')
          .populate('members.function');

        // Buscar músicas relacionadas (pelo URL ou pelo ID)
        const urls = (event.musicLinks || []).map(m => m.url);
        const songIds = (event.musicLinks || [])
          .filter(m => m.song) // se tiver songId futuro
          .map(m => m.song);
        
        const songs = await Song.find({
          $or: [
            { youtubeUrl: { $in: urls } },
            { _id: { $in: songIds } }
          ]
        });

        const enrichedMusicLinks = (event.musicLinks || []).map(m => {
          const song = songs.find(s =>
            (s.youtubeUrl && s.youtubeUrl === m.url) ||
            (s._id && m.song && s._id.toString() === m.song.toString())
          );
          if (song) {
            return {
              ...m,
              bpm: song.bpm,
              duration: song.duration,
              key: song.key,
              coverUrl: song.coverUrl
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
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }

    const scale = await Scale.findOne({ eventId: event._id })
      .populate('members.user')
      .populate('members.function');

    const urls = (event.musicLinks || []).map(m => m.url);
    const songIds = (event.musicLinks || [])
      .filter(m => m.song)
      .map(m => m.song);

    const songs = await Song.find({
      $or: [
        { youtubeUrl: { $in: urls } },
        { _id: { $in: songIds } }
      ]
    });

    const enrichedMusicLinks = (event.musicLinks || []).map(m => {
      const song = songs.find(s =>
        (s.youtubeUrl && s.youtubeUrl === m.url) ||
        (s._id && m.song && s._id.toString() === m.song.toString())
      );
      if (song) {
        return {
          ...m,
          bpm: song.bpm,
          duration: song.duration,
          key: song.key,
          coverUrl: song.coverUrl
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

module.exports = {
  getEventsWithScales,
  getEventById,
};
