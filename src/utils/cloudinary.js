const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Tipos de arquivos permitidos
const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
  "application/zip",
  "audio/mpeg",
  "image/jpeg",
  "image/png",
  "image/webp",
];

// ✅ Detecta tipo de recurso para o Cloudinary
function resolveResourceType(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "video"; // Cloudinary trata áudio como vídeo
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/octet-stream" ||
    mimeType === "application/zip"
  ) return "raw";

  return "auto";
}

// ✅ Upload universal com retorno completo e válido
exports.uploadFile = async (file) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    console.warn("📛 MIME TYPE REJEITADO:", file.mimetype);
    throw new Error("Tipo de arquivo não permitido.");
  }

  const resourceType = resolveResourceType(file.mimetype);
  console.log(`📦 Upload → Mimetype: ${file.mimetype} | Resource Type: ${resourceType}`);

  const result = await cloudinary.uploader.upload(file.path, {
    overwrite: true,
    resource_type: resourceType,
    folder: "louvor-app",
    use_filename: true,
    unique_filename: false,
  });

  return {
    url: result.secure_url,
    public_id: result.public_id,
    format: result.format,
    resource_type: result.resource_type,
    bytes: result.bytes,
    original_filename: result.original_filename,
  };
};

// ✅ Exclusão com retorno de sucesso e tipo
exports.deleteFile = async (publicId) => {
  const typesToTry = ["image", "raw", "video"];

  for (const type of typesToTry) {
    try {
      const res = await cloudinary.uploader.destroy(publicId, { resource_type: type });
      if (res.result === "ok" || res.result === "not_found") {
        return { success: res.result === "ok", type };
      }
    } catch (err) {
      console.error(`Erro ao tentar deletar como ${type}:`, err.message);
    }
  }

  throw new Error("Falha ao deletar arquivo. Tente novamente.");
};
