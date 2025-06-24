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
  "application/octet-stream", // binários genéricos
  "application/zip",
  "audio/mpeg",
  "image/jpeg",
  "image/png",
  "video/mp4",
];

// ✅ Função para detectar o tipo de recurso com base no mimetype
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
  )
    return "raw";

  return "auto"; // fallback seguro
}

// ✅ Função principal de upload
exports.uploadFile = async (file) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    console.warn("📛 MIME TYPE REJEITADO:", file.mimetype);
    throw new Error("Tipo de arquivo não permitido.");
  }

  const resourceType = resolveResourceType(file.mimetype);
  console.log(`📦 Upload → Mimetype: ${file.mimetype} | Resource Type: ${resourceType}`);

  return await cloudinary.uploader.upload(file.path, {
    overwrite: true,
    resource_type: resourceType,
    folder: "louvor-app", // ✅ Organização
    use_filename: true,
    unique_filename: false,
  });
};

// ✅ Função de exclusão
exports.deleteFile = async (publicId) => {
  return await cloudinary.uploader.destroy(publicId, {
    resource_type: "auto",
  });
};

