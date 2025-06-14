const { deleteFile } = require('../utils/cloudinary');

exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ message: 'O publicId é obrigatório.' });
    }

    const result = await deleteFile(publicId);

    if (result.result === 'ok' || result.result === 'not found') {
      return res.status(200).json({ message: 'Imagem deletada com sucesso do Cloudinary.', result });
    } else {
      return res.status(500).json({ message: 'Falha ao deletar a imagem do Cloudinary.', result });
    }

  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    res.status(500).json({ message: 'Erro interno ao deletar imagem.', error });
  }
};
