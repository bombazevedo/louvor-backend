const Event = require("../models/Event");

exports.updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate({
      path: "scale",
      populate: {
        path: "members.user",
      },
    });

    if (!event) return res.status(404).json({ message: "Evento não encontrado." });

    if (
      req.user.role !== "coordinator" &&
      !event.scale?.members?.some((m) => m.user?._id?.toString() === req.user.id)
    ) {
      return res.status(403).json({ message: "Sem permissão para editar este evento." });
    }

    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    res.json(updatedEvent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao atualizar evento." });
  }
};
