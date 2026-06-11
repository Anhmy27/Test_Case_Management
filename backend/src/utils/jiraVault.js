const crypto = require('crypto');

const KEY_BYTES = 32;

const getVaultSecret = () => {
  const secret = String(process.env.JIRA_VAULT_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('JIRA_VAULT_SECRET or JWT_SECRET is required to protect Jira credentials');
  }

  return crypto.createHash('sha256').update(secret).digest().subarray(0, KEY_BYTES);
};

const encryptText = (plaintext) => {
  const raw = String(plaintext || '');
  if (!raw) return '';

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getVaultSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
};

const decryptText = (payload) => {
  const raw = String(payload || '');
  if (!raw) return '';

  const [version, ivB64, tagB64, dataB64] = raw.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    return raw;
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getVaultSecret(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
};

module.exports = {
  decryptText,
  encryptText,
};
