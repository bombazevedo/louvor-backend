const Scale = require("../models/Scale");

exports.updateScale = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id).populate("members.user");

    if (!scale) return res.status(404).json({ message: "Escala não encontrada." });

    if (
      req.user.role !== "coordinator" &&
      !scale.members?.some((m) => m.user?._id?.toString() === req.user.id)
    ) {
      return res.status(403).json({ message: "Sem permissão para editar esta escala." });
    }

    const updatedScale = await Scale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(updatedScale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao atualizar escala." });
  }
};
