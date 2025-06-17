import Unavailability from '../models/Unavailability.js';

// ✔️ Criar indisponibilidade
export const createUnavailability = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'StartDate e EndDate são obrigatórios.' });
    }

    const exists = await Unavailability.findOne({
      userId: req.userId,
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) },
        },
      ],
    });

    if (exists) {
      return res.status(400).json({ message: 'Período sobreposto. Já existe indisponibilidade cadastrada neste intervalo.' });
    }

    const unavailability = await Unavailability.create({
      userId: req.userId,
      startDate,
      endDate,
    });

    res.status(201).json(unavailability);
  } catch (error) {
    console.error('Erro ao criar indisponibilidade:', error);
    res.status(500).json({ message: 'Erro ao criar indisponibilidade.' });
  }
};

// ✔️ Listar indisponibilidades do usuário logado
export const getMyUnavailability = async (req, res) => {
  try {
    const data = await Unavailability.find({ userId: req.userId }).sort({ startDate: 1 });
    res.status(200).json(data);
  } catch (error) {
    console.error('Erro ao listar indisponibilidades:', error);
    res.status(500).json({ message: 'Erro ao listar indisponibilidades.' });
  }
};

// ✔️ Deletar indisponibilidade
export const deleteUnavailability = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Unavailability.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Indisponibilidade não encontrada.' });
    }

    res.status(200).json({ message: 'Indisponibilidade removida com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar indisponibilidade:', error);
    res.status(500).json({ message: 'Erro ao deletar indisponibilidade.' });
  }
};

// ✔️ Checar quem está indisponível para uma data específica
export const getUnavailabilityByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);

    const unavailable = await Unavailability.find({
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate },
    }).populate('userId', 'name email');

    res.status(200).json(unavailable);
  } catch (error) {
    console.error('Erro ao consultar indisponibilidade:', error);
    res.status(500).json({ message: 'Erro ao consultar indisponibilidade.' });
  }
};
