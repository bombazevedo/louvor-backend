const { uploadFile, deleteFile } = require('../utils/cloudinary'); // ✅ Caminho correto

// ✅ Upload universal de arquivos (PDF, imagem, vídeo, áudio, DOC, etc.)
exports.uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const result = await uploadFile(file);

    return res.status(200).json({
      name: file.originalname,
      url: result.secure_url,
      public_id: result.public_id,
      mimetype: file.mimetype,
    });
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ✅ Exclusão de arquivo Cloudinary pelo publicId
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
