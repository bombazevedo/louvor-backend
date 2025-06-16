const cloudinary = require("cloudinary").v2;

// ✅ Configuração correta com os nomes das variáveis conforme Railway e .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "audio/mpeg",
  "image/jpeg",
  "image/png",
  "video/mp4",
];

// ✅ Upload de arquivos (imagens, PDF, áudio, vídeo)
exports.uploadFile = async (file) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("Tipo de arquivo não permitido.");
  }

  return await cloudinary.uploader.upload(file.path, {
    overwrite: true, // 🚩 Chave da solução — substitui a imagem anterior
    upload_preset: "louvor_unsigned", // Se estiver configurado no Cloudinary
    resource_type: "auto",
  });
};

// ✅ Exclusão de arquivo no Cloudinary pelo publicId (continua disponível caso precise)
exports.deleteFile = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId);
};
