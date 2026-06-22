const DEFAULT_JWT_EXPIRES_IN = '8h';

const WEAK_JWT_SECRETS = new Set([
  'replace-me-secret',
  'super-secret-change-me',
  'changeme',
  'secret',
  'jwt-secret',
]);

function getJwtExpiresIn() {
  const configured = String(process.env.JWT_EXPIRES_IN || '').trim();
  return configured || DEFAULT_JWT_EXPIRES_IN;
}

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET is required. Set a strong secret in backend/.env');
  }

  const isWeak = WEAK_JWT_SECRETS.has(secret) || secret.length < 32;
  if (isWeak && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is too weak for production. Use a random string of at least 32 characters.');
  }

  return secret;
}

function assertJwtConfig() {
  getJwtSecret();
  getJwtExpiresIn();
}

module.exports = {
  DEFAULT_JWT_EXPIRES_IN,
  assertJwtConfig,
  getJwtExpiresIn,
  getJwtSecret,
};
