const { uploadFile, deleteFile } = require('../utils/cloudinary');

// ✅ Upload de arquivos (imagens, PDFs, vídeos, áudios)
exports.uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const result = await uploadFile(file);
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ✅ Delete de arquivos (imagem, PDF, etc) no Cloudinary
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) return res.status(400).json({ error: 'publicId obrigatório' });

    const result = await deleteFile(publicId);
    return res.status(200).json({ result });
  } catch (error) {
    console.error('❌ Erro ao deletar imagem:', error);
    return res.status(500).json({ error: error.message });
  }
};
