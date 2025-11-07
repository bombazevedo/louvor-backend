module.exports = function licenseGuard(req, res, next) {
  try {
    const isWrite = ['POST','PUT','PATCH','DELETE'].includes(req.method);
    if (!isWrite) return next();
    const org = req._org || {};
    const { status, trialEnd } = org.license || {};
    const expired = (status === 'expired') || (trialEnd && Date.now() > new Date(trialEnd).getTime());
    if (expired) {
      return res.status(402).json({ error: 'TRIAL_EXPIRED', message: 'Período de avaliação encerrado.' });
    }
    next();
  } catch (err) {
    console.error('[licenseGuard] erro:', err);
    res.status(500).json({ error: 'LICENSE_GUARD_ERROR' });
  }
};
