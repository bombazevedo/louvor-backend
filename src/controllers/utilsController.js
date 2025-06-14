const { deleteFile } = require('../utils/cloudinary');

exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ message: 'O publicId é obrigatório' });
    }

    const result = await deleteFile(publicId);
    return res.status(200).json({ message: 'Imagem deletada com sucesso', result });
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    return res.status(500).json({ message: 'Erro interno ao deletar imagem' });
  }
};
