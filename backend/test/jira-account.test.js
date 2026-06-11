const test = require('node:test');
const assert = require('node:assert/strict');

test('jira vault encrypts and decrypts round trip', () => {
  const previousVaultSecret = process.env.JIRA_VAULT_SECRET;
  process.env.JIRA_VAULT_SECRET = 'jira-vault-secret-that-is-long-enough-123';

  delete require.cache[require.resolve('../src/utils/jiraVault')];
  const { encryptText, decryptText } = require('../src/utils/jiraVault');

  const encrypted = encryptText('super-secret-password');
  assert.notEqual(encrypted, 'super-secret-password');
  assert.equal(decryptText(encrypted), 'super-secret-password');

  if (previousVaultSecret === undefined) {
    delete process.env.JIRA_VAULT_SECRET;
  } else {
    process.env.JIRA_VAULT_SECRET = previousVaultSecret;
  }
  delete require.cache[require.resolve('../src/utils/jiraVault')];
});

test('jira account service builds stable profile keys', () => {
  const { buildProfileKey, getJiraProfileView } = require('../src/services/jiraAccountService');

  assert.equal(buildProfileKey({ profileType: 'service' }), 'service:default');
  assert.equal(
    buildProfileKey({ profileType: 'user', userId: '507f1f77bcf86cd799439011' }),
    'user:507f1f77bcf86cd799439011',
  );

  const view = getJiraProfileView({
    profileKey: 'user:507f1f77bcf86cd799439011',
    profileType: 'user',
    userId: '507f1f77bcf86cd799439011',
    jiraUsername: 'jira-user',
    jiraPasswordEncrypted: 'encrypted',
    jiraCookieHeaderEncrypted: 'encrypted-cookie',
    sessionExpiresAt: null,
    lastVerifiedAt: null,
    isActive: true,
  });

  assert.deepEqual(view, {
    profileKey: 'user:507f1f77bcf86cd799439011',
    profileType: 'user',
    userId: '507f1f77bcf86cd799439011',
    jiraUsername: 'jira-user',
    hasPassword: true,
    hasSession: true,
    sessionExpiresAt: null,
    lastVerifiedAt: null,
    isActive: true,
  });
});
