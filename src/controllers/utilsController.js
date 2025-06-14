// src/controllers/utilsController.js

const cloudinary = require('../utils/cloudinary');

exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ message: 'publicId não fornecido' });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.status(200).json({ message: 'Imagem deletada com sucesso.' });
    } else {
      res.status(404).json({ message: 'Imagem não encontrada no Cloudinary.' });
    }
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    res.status(500).json({ message: 'Erro interno ao deletar imagem.' });
  }
};
