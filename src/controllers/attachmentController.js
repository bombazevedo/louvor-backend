const asyncHandler = require('express-async-handler');
const cloudinary = require('../utils/cloudinary');

// @desc    Excluir anexo do Cloudinary
// @route   DELETE /api/attachments/:publicId
// @access  Private
const deleteAttachment = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  if (!publicId) {
    return res.status(400).json({ message: 'publicId é obrigatório.' });
  }

  const result = await cloudinary.deleteImage(publicId);

  if (!result || result.result !== 'ok') {
    return res.status(400).json({ message: 'Falha ao deletar anexo.' });
  }

  res.json({ message: 'Anexo removido com sucesso.' });
});

module.exports = { deleteAttachment };
