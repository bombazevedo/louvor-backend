const Scale = require('../models/Scale');

const createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;

    const validatedMembers = members.filter(
      (m) => m.user && m.function
    );

    const uniqueMembers = validatedMembers.filter(
      (member, index, self) =>
        index === self.findIndex(
          (m) =>
            m.user.toString() === member.user.toString() &&
            m.function.toString() === member.function.toString()
        )
    );

    const scale = new Scale({
      eventId,
      members: uniqueMembers,
      notes,
    });

    await scale.save();
    res.status(201).json(scale);
  } catch (error) {
    console.error('Erro ao criar escala:', error);
    res.status(500).json({ message: 'Erro ao criar escala' });
  }
};

const updateScale = async (req, res) => {
  try {
    const { members, notes } = req.body;
    const scale = await Scale.findById(req.params.id);

    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }

    const validatedMembers = members.filter(
      (m) => m.user && m.function
    );

    const uniqueMembers = validatedMembers.filter(
      (member, index, self) =>
        index === self.findIndex(
          (m) =>
            m.user.toString() === member.user.toString() &&
            m.function.toString() === member.function.toString()
        )
    );

    scale.members = uniqueMembers;
    scale.notes = notes;
    await scale.save();

    res.json(scale);
  } catch (error) {
    console.error('Erro ao atualizar escala:', error);
    res.status(500).json({ message: 'Erro ao atualizar escala' });
  }
};

module.exports = {
  createScale,
  updateScale,
};
