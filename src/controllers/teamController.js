const Team = require('../models/Team');

// Cria uma nova equipe (apenas coordenador)
exports.createTeam = async (req, res) => {
  console.log('>>>> [createTeam] Início da criação de equipe');
  try {
    console.log('>>>> [createTeam] Usuário autenticado:', req.user);
    const { name, members } = req.body;
    console.log('>>>> [createTeam] Body recebido:', req.body);

    if (!req.user || req.user.role !== 'coordenador') {
      console.warn('>>>> [createTeam] Permissão negada: usuário não é coordenador');
      return res.status(403).json({ error: 'Apenas coordenador pode criar equipes.' });
    }

    if (!name || !members || !Array.isArray(members) || members.length === 0) {
      console.warn('>>>> [createTeam] Falha de validação: nome ou membros ausentes/invalidos');
      return res.status(400).json({ error: 'Preencha nome e membros da equipe.' });
    }

    // Log dos membros para garantir que cada campo está correto
    members.forEach((m, idx) => {
      console.log(`>>>> [createTeam] Membro[${idx}]:`, m);
    });

    const newTeam = new Team({
      name,
      members,
      createdBy: req.user._id
    });
    console.log('>>>> [createTeam] Novo objeto Team criado:', newTeam);

    await newTeam.save();
    console.log('>>>> [createTeam] Equipe salva com sucesso:', newTeam._id);
    res.status(201).json(newTeam);
  } catch (err) {
    console.error('>>>> [createTeam] ERRO AO CRIAR EQUIPE:', err);
    res.status(500).json({ error: 'Erro ao criar equipe.' });
  }
};

// Lista todas as equipes (aberto a todos)
exports.getTeams = async (req, res) => {
  console.log('>>>> [getTeams] Listando equipes');
  try {
    const teams = await Team.find()
      .populate('members.user', 'name avatar')
      .populate('members.bandRole', 'name icon')
      .sort({ createdAt: -1 });
    console.log('>>>> [getTeams] Total equipes encontradas:', teams.length);
    res.json(teams);
  } catch (err) {
    console.error('>>>> [getTeams] ERRO:', err);
    res.status(500).json({ error: 'Erro ao buscar equipes.' });
  }
};

// Busca equipe por ID (aberto a todos)
exports.getTeamById = async (req, res) => {
  console.log('>>>> [getTeamById] Buscando equipe:', req.params.id);
  try {
    const team = await Team.findById(req.params.id)
      .populate('members.user', 'name avatar')
      .populate('members.bandRole', 'name icon');
    if (!team) {
      console.warn('>>>> [getTeamById] Equipe não encontrada:', req.params.id);
      return res.status(404).json({ error: 'Equipe não encontrada.' });
    }
    res.json(team);
  } catch (err) {
    console.error('>>>> [getTeamById] ERRO:', err);
    res.status(500).json({ error: 'Erro ao buscar equipe.' });
  }
};

// Edita equipe (apenas coordenador)
exports.updateTeam = async (req, res) => {
  console.log('>>>> [updateTeam] Início da edição de equipe:', req.params.id);
  try {
    if (!req.user || req.user.role !== 'coordenador') {
      console.warn('>>>> [updateTeam] Permissão negada: usuário não é coordenador');
      return res.status(403).json({ error: 'Apenas coordenador pode editar equipes.' });
    }
    const { name, members } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) {
      console.warn('>>>> [updateTeam] Equipe não encontrada:', req.params.id);
      return res.status(404).json({ error: 'Equipe não encontrada.' });
    }
    team.name = name || team.name;
    team.members = members || team.members;
    await team.save();
    console.log('>>>> [updateTeam] Equipe editada com sucesso:', team._id);
    res.json(team);
  } catch (err) {
    console.error('>>>> [updateTeam] ERRO AO EDITAR EQUIPE:', err);
    res.status(500).json({ error: 'Erro ao editar equipe.' });
  }
};

// Exclui equipe (apenas coordenador)
exports.deleteTeam = async (req, res) => {
  console.log('>>>> [deleteTeam] Tentando excluir equipe:', req.params.id);
  try {
    if (!req.user || req.user.role !== 'coordenador') {
      console.warn('>>>> [deleteTeam] Permissão negada: usuário não é coordenador');
      return res.status(403).json({ error: 'Apenas coordenador pode excluir equipes.' });
    }
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) {
      console.warn('>>>> [deleteTeam] Equipe não encontrada para excluir:', req.params.id);
      return res.status(404).json({ error: 'Equipe não encontrada.' });
    }
    console.log('>>>> [deleteTeam] Equipe excluída com sucesso:', req.params.id);
    res.json({ message: 'Equipe excluída com sucesso.' });
  } catch (err) {
    console.error('>>>> [deleteTeam] ERRO AO EXCLUIR EQUIPE:', err);
    res.status(500).json({ error: 'Erro ao excluir equipe.' });
  }
};
