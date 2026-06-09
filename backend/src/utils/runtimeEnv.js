const isProduction = () => process.env.NODE_ENV === 'production';

const stripHtml = (value) => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const looksLikeMarkup = (value) => {
  const text = String(value || '');
  return /<(?:html|body|head|script|style|div|form|!doctype)\b/i.test(text)
    || text.length > 300;
};

const sanitizeClientErrorMessage = (message, { statusCode = 500, fallback } = {}) => {
  const defaultFallback = statusCode >= 500
    ? (statusCode === 502 ? 'Upstream service error' : 'Internal Server Error')
    : 'Request failed';
  const safeFallback = fallback || defaultFallback;

  if (!isProduction()) {
    return String(message || '').trim() || safeFallback;
  }

  const trimmed = String(message || '').trim();
  if (!trimmed || looksLikeMarkup(trimmed) || trimmed.length > 240) {
    return safeFallback;
  }

  return trimmed;
};

module.exports = {
  isProduction,
  stripHtml,
  sanitizeClientErrorMessage,
};
