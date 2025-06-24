const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");

// ✅ Upload de arquivo
exports.upload = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    const result = await cloudinary.uploadFile(file);

    // ✅ Remove o arquivo local após upload
    fs.unlink(file.path, (err) => {
      if (err) console.error("Erro ao excluir arquivo temporário:", err);
    });

    return res.status(200).json({
      message: "Upload realizado com sucesso!",
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
    });
  } catch (error) {
    console.error("Erro no upload:", error);
    return res.status(500).json({
      error: "Erro ao fazer upload do arquivo.",
      detalhes: error.message,
    });
  }
};

// ✅ Exclusão de arquivo
exports.delete = async (req, res) => {
  try {
    const { public_id } = req.body;

    if (!public_id) {
      return res.status(400).json({ error: "public_id não fornecido." });
    }

    const result = await cloudinary.deleteFile(public_id);
    return res.status(200).json({
      message: "Arquivo excluído com sucesso!",
      result,
    });
  } catch (error) {
    console.error("Erro na exclusão:", error);
    return res.status(500).json({
      error: "Erro ao excluir o arquivo.",
      detalhes: error.message,
    });
  }
};
