const { v2: cloudinary } = require('cloudinary');

// ✅ Upload de arquivos (imagens, PDFs, vídeos, áudios)
exports.uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const result = await cloudinary.uploader.upload(file.path, {
      resource_type: 'auto',        // ✅ Corrigido: agora aceita qualquer tipo
      folder: 'louvor-app',
    });

    return res.status(200).json({
      name: file.originalname,
      url: result.secure_url,
      public_id: result.public_id,
    });
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

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'auto'         // ✅ Garante remoção de qualquer tipo
    });

    return res.status(200).json({ result });
  } catch (error) {
    console.error('❌ Erro ao deletar imagem:', error);
    return res.status(500).json({ error: error.message });
  }
};
