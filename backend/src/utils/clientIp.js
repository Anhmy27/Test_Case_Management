function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const firstHop = String(forwarded).split(',')[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const ip = req.ip || req.socket?.remoteAddress || '';
  return String(ip).trim() || 'unknown';
}

module.exports = {
  getClientIp,
};
