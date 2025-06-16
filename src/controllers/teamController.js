const Team = require('../models/Team');

// Cria uma nova equipe (apenas coordenador)
exports.createTeam = async (req, res) => {
  try {
    if (req.user.role !== 'coordenador') {
      return res.status(403).json({ error: 'Apenas coordenador pode criar equipes.' });
    }
    const { name, members } = req.body;
    if (!name || !members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'Preencha nome e membros da equipe.' });
    }
    const newTeam = new Team({
      name,
      members,
      createdBy: req.user._id
    });
    await newTeam.save();
    res.status(201).json(newTeam);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar equipe.' });
  }
};

// Lista todas as equipes (aberto a todos)
exports.getTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('members.user', 'name avatar')
      .populate('members.bandRole', 'name icon')
      .sort({ createdAt: -1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar equipes.' });
  }
};

// Busca equipe por ID (aberto a todos)
exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.user', 'name avatar')
      .populate('members.bandRole', 'name icon');
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar equipe.' });
  }
};

// Edita equipe (apenas coordenador)
exports.updateTeam = async (req, res) => {
  try {
    if (req.user.role !== 'coordenador') {
      return res.status(403).json({ error: 'Apenas coordenador pode editar equipes.' });
    }
    const { name, members } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    team.name = name || team.name;
    team.members = members || team.members;
    await team.save();
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao editar equipe.' });
  }
};

// Exclui equipe (apenas coordenador)
exports.deleteTeam = async (req, res) => {
  try {
    if (req.user.role !== 'coordenador') {
      return res.status(403).json({ error: 'Apenas coordenador pode excluir equipes.' });
    }
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ error: 'Equipe não encontrada.' });
    res.json({ message: 'Equipe excluída com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir equipe.' });
  }
};
