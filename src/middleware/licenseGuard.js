module.exports = function licenseGuard(req, res, next) { 
  try {
    const { getEntitlementsFor } = require('../utils/entitlements'); // ✅ adição cirúrgica

    // 🔧 núcleo reutilizável (mantém legado e novo modo)
    const core = (req_, res_, next_, mode /* 'auto' | 'read' | 'write' */, operation /* opcional */) => {
      // decide se é escrita: mantém comportamento anterior por padrão
      const isWrite = mode === 'write'
        ? true
        : mode === 'read'
          ? false
          : ['POST','PUT','PATCH','DELETE'].includes(req_.method);

      // obtém entitlements da org atual (se houver)
      const org = req_._org || {};
      const ent = getEntitlementsFor(org);
      // expõe para middlewares/handlers seguintes
      req_.entitlements = ent;

      // leitura nunca bloqueia aqui (como antes)
      if (!isWrite) return next_();

      // 🔒 pós-ajuste: sem bloqueio rígido por "expired" aqui.
      // Agora obedecemos ao plano/entitlements:
      // - FREE: write.allowed = true, mode = 'limited'  → segue; limites tratados no limitsGuard
      // - PRO/PLUS ou TRIAL ativo: 'full'              → segue normal
      // - Caso algum plano/override desabilite escrita: bloqueia aqui
      const writeAllowed = ent?.write?.allowed !== false;
      const writeMode = ent?.write?.mode || 'full';

      if (!writeAllowed || writeMode === 'blocked') {
        return res_.status(402).json({
          error: 'LICENSE_RESTRICTED',
          message: 'Edição bloqueada pelo plano atual.',
          plan: ent?.plan || 'FREE'
        });
      }

      // Limites (quantidades, datas, features) não são verificados aqui.
      // Eles devem ser aplicados pelo limitsGuard, por operação (ex.: 'event:add-song').
      return next_();
    };

    // 🔙 compatibilidade com assinatura antiga: (req,res,next)
    if (res && next && req && req.headers) {
      return core(req, res, next, 'auto', null);
    }

    // 🧰 modo novo: licenseGuard(mode?, operation?)
    const mode = req || 'auto';     // quando chamado como fábrica, o 1º arg é 'mode'
    const operation = res || null;  // e o 2º arg é 'operation'
    return function licenseGuardMiddleware(req_, res_, next_) {
      try {
        return core(req_, res_, next_, mode, operation);
      } catch (err) {
        console.error('[licenseGuard] erro:', err);
        return res_.status(500).json({ error: 'LICENSE_GUARD_ERROR' });
      }
    };

  } catch (err) {
    console.error('[licenseGuard] erro:', err);
    res.status(500).json({ error: 'LICENSE_GUARD_ERROR' });
  }
};
