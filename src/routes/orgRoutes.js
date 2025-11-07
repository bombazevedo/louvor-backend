const express = require('express');
const router = express.Router();
const orgCtl = require('../controllers/orgController');
const auth = require('../middleware/auth'); // o mesmo auth que você já usa

// Usuário precisa estar logado
router.post('/', auth, orgCtl.createOrg);
router.post('/:id/invite', auth, orgCtl.generateInvite);
router.post('/join', auth, orgCtl.joinByCode);
router.get('/mine', auth, orgCtl.myOrgs);

module.exports = router;
