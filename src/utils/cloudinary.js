const { v2: cloudinary } = require("cloudinary");
const fs = require('fs');

cloudinary.config({
  cloud_name: 'dy3xtqqkk', // ← força o mesmo cloud visto nas URLs/logs
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/octet-stream",
  "application/zip",
  "audio/mpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function resolveResourceType(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "video";
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/octet-stream" ||
    mimeType === "application/zip"
  ) return "raw";
  return "auto";
}

// ✅ Upload universal (compatível com URI ou path)
exports.uploadFile = async (file) => {
  const filePath = file.path || file.uri;
  const mimeType = file.mimetype || file.mimeType || 'application/octet-stream';

  if (!filePath) {
    throw new Error("Arquivo inválido: ausência de path ou uri.");
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    console.warn("📛 MIME TYPE REJEITADO:", mimeType);
    throw new Error("Tipo de arquivo não permitido.");
  }

  const resourceType = resolveResourceType(mimeType);

  const result = await cloudinary.uploader.upload(filePath, {
    overwrite: true,
    resource_type: resourceType,
    folder: "louvor-app",
    public_id: file.publicId || undefined,
    use_filename: !file.publicId,
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

// ✅ Exclusão de arquivo Cloudinary com fallback de tipo
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
