const { uploadFile, deleteFile } = require('../utils/cloudinary');

// ✅ Upload universal de arquivos
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

// ✅ Exclusão de arquivo Cloudinary por publicId com verificação
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) return res.status(400).json({ error: 'publicId obrigatório' });

    const result = await deleteFile(publicId); // função do cloudinary já verifica tipo

    if (result.success) {
      return res.status(200).json({ message: 'Arquivo deletado com sucesso', type: result.type });
    } else {
      return res.status(404).json({ error: 'Arquivo não encontrado no Cloudinary' });
    }
  } catch (error) {
    console.error('❌ Erro ao deletar imagem:', error);
    return res.status(500).json({ error: error.message });
  }
};
