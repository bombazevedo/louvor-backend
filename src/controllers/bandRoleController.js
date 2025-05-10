const BandRole = require('../models/BandRole');

// Criar nova função de banda
exports.createBandRole = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'O nome da função é obrigatório.' });
    }

    const roleExists = await BandRole.findOne({ name: name.trim() });
    if (roleExists) {
      return res.status(409).json({ message: 'Essa função já está cadastrada.' });
    }

    const newRole = new BandRole({ name: name.trim() });
    const savedRole = await newRole.save();
    res.status(201).json(savedRole);
  } catch (error) {
    console.error('Erro ao criar função de banda:', error);
    res.status(500).json({ message: 'Erro ao criar função de banda.', error: error.message });
  }
};

// Listar todas as funções
exports.getAllBandRoles = async (req, res) => {
  try {
    const roles = await BandRole.find().sort({ name: 1 });
    res.status(200).json(roles);
  } catch (error) {
    console.error('Erro ao buscar funções de banda:', error);
    res.status(500).json({ message: 'Erro ao buscar funções de banda.', error: error.message });
  }
};

// Deletar função por ID
exports.deleteBandRole = async (req, res) => {
  try {
    const roleId = req.params.id;
    const deleted = await BandRole.findByIdAndDelete(roleId);
    if (!deleted) {
      return res.status(404).json({ message: 'Função de banda não encontrada.' });
    }
    res.status(200).json({ message: 'Função deletada com sucesso.' });
  } catch (error) {
    console.error('Erro ao deletar função de banda:', error);
    res.status(500).json({ message: 'Erro ao deletar função de banda.', error: error.message });
  }
};