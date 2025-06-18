const Team = require('../models/Team');

const createTeam = async (req, res) => {
  try {
    const { name, members } = req.body;

    const validatedMembers = members.filter(
      (m) => m.user && m.bandRole
    );

    const uniqueMembers = validatedMembers.filter(
      (member, index, self) =>
        index === self.findIndex(
          (m) =>
            m.user.toString() === member.user.toString() &&
            m.bandRole.toString() === member.bandRole.toString()
        )
    );

    const team = new Team({
      name,
      members: uniqueMembers,
    });

    await team.save();
    res.status(201).json(team);
  } catch (error) {
    console.error('Erro ao criar time:', error);
    res.status(500).json({ message: 'Erro ao criar time' });
  }
};

const updateTeam = async (req, res) => {
  try {
    const { name, members } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    const validatedMembers = members.filter(
      (m) => m.user && m.bandRole
    );

    const uniqueMembers = validatedMembers.filter(
      (member, index, self) =>
        index === self.findIndex(
          (m) =>
            m.user.toString() === member.user.toString() &&
            m.bandRole.toString() === member.bandRole.toString()
        )
    );

    team.name = name;
    team.members = uniqueMembers;
    await team.save();

    res.json(team);
  } catch (error) {
    console.error('Erro ao atualizar time:', error);
    res.status(500).json({ message: 'Erro ao atualizar time' });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);

    if (!team) {
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    res.json({ message: 'Time excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir time:', error);
    res.status(500).json({ message: 'Erro ao excluir time' });
  }
};

const getTeams = async (req, res) => {
  try {
    const teams = await Team.find().populate('members.user').populate('members.bandRole');
    res.json(teams);
  } catch (error) {
    console.error('Erro ao buscar times:', error);
    res.status(500).json({ message: 'Erro ao buscar times' });
  }
};

const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).populate('members.user').populate('members.bandRole');

    if (!team) {
      return res.status(404).json({ message: 'Time não encontrado' });
    }

    res.json(team);
  } catch (error) {
    console.error('Erro ao buscar time:', error);
    res.status(500).json({ message: 'Erro ao buscar time' });
  }
};

module.exports = {
  createTeam,
  updateTeam,
  deleteTeam,
  getTeams,
  getTeamById,
};
