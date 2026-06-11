const JiraAccount = require('../models/JiraAccount');
const { decryptText, encryptText } = require('../utils/jiraVault');

const SERVICE_PROFILE_KEY = 'service:default';

const normalize = (value) => String(value || '').trim();

const buildProfileKey = ({ profileType, userId }) => {
  if (profileType === 'service') {
    return SERVICE_PROFILE_KEY;
  }

  return `user:${normalize(userId)}`;
};

const getProfileByKey = async (profileKey) =>
  JiraAccount.findOne({ profileKey: normalize(profileKey) }).lean();

const getUserJiraAccount = async (userId) => {
  if (!normalize(userId)) {
    return null;
  }

  return getProfileByKey(buildProfileKey({ profileType: 'user', userId }));
};

const getEffectiveJiraAccount = async (userId) => {
  const userAccount = await getUserJiraAccount(userId);
  if (!userAccount || userAccount.isActive === false) {
    return null;
  }

  return userAccount;
};

const decryptJiraAccountSecrets = (account) => {
  if (!account) {
    return null;
  }

  return {
    ...account,
    jiraPassword: decryptText(account.jiraPasswordEncrypted),
    jiraCookieHeader: decryptText(account.jiraCookieHeaderEncrypted),
  };
};

const storeJiraSession = async ({
  profileKey,
  userId,
  profileType = 'user',
  jiraCookieHeader = '',
  sessionExpiresAt = null,
}) => {
  const resolvedProfileKey = normalize(profileKey) || buildProfileKey({ profileType, userId });
  const updates = {
    profileKey: resolvedProfileKey,
    profileType,
    userId: profileType === 'service' ? null : userId,
    sessionExpiresAt: sessionExpiresAt || null,
    lastVerifiedAt: new Date(),
    isActive: true,
  };

  if (typeof jiraCookieHeader === 'string') {
    const trimmed = normalize(jiraCookieHeader);
    updates.jiraCookieHeaderEncrypted = trimmed ? encryptText(trimmed) : '';
  }

  await JiraAccount.updateOne(
    { profileKey: resolvedProfileKey },
    {
      $set: updates,
      $setOnInsert: {
        jiraUsername: '',
        jiraPasswordEncrypted: '',
      },
    },
    { upsert: true },
  );

  return JiraAccount.findOne({ profileKey: resolvedProfileKey }).lean();
};

const clearJiraSession = async ({ profileKey, userId, profileType = 'user' }) => {
  const resolvedProfileKey = normalize(profileKey) || buildProfileKey({ profileType, userId });
  await JiraAccount.updateOne(
    { profileKey: resolvedProfileKey },
    {
      $set: {
        jiraCookieHeaderEncrypted: '',
        sessionExpiresAt: null,
        lastVerifiedAt: null,
      },
    },
  );
};

const upsertUserJiraAccount = async ({ userId, jiraUsername, jiraPassword, jiraCookieHeader }) => {
  const profileKey = buildProfileKey({ profileType: 'user', userId });
  const existing = await getProfileByKey(profileKey);
  const updates = {
    profileKey,
    profileType: 'user',
    userId,
    isActive: true,
  };

  if (typeof jiraUsername === 'string') {
    updates.jiraUsername = normalize(jiraUsername);
  }
  if (typeof jiraPassword === 'string') {
    const trimmed = normalize(jiraPassword);
    updates.jiraPasswordEncrypted = trimmed ? encryptText(trimmed) : '';
  }
  if (typeof jiraCookieHeader === 'string') {
    const trimmed = normalize(jiraCookieHeader);
    updates.jiraCookieHeaderEncrypted = trimmed ? encryptText(trimmed) : '';
  }

  if (!existing) {
    const shouldCreate = Boolean(updates.jiraUsername || updates.jiraPasswordEncrypted || updates.jiraCookieHeaderEncrypted);
    if (!shouldCreate) {
      return null;
    }
    return JiraAccount.create(updates);
  }

  await JiraAccount.updateOne({ profileKey }, { $set: updates }, { upsert: true });
  return JiraAccount.findOne({ profileKey }).lean();
};

const getJiraProfileView = (account) => {
  if (!account) return null;

  return {
    profileKey: account.profileKey,
    profileType: account.profileType,
    userId: account.userId,
    jiraUsername: account.jiraUsername,
    hasPassword: Boolean(account.jiraPasswordEncrypted),
    hasSession: Boolean(account.jiraCookieHeaderEncrypted),
    sessionExpiresAt: account.sessionExpiresAt || null,
    lastVerifiedAt: account.lastVerifiedAt || null,
    isActive: account.isActive !== false,
  };
};

module.exports = {
  SERVICE_PROFILE_KEY,
  buildProfileKey,
  clearJiraSession,
  decryptJiraAccountSecrets,
  getEffectiveJiraAccount,
  getJiraProfileView,
  getUserJiraAccount,
  storeJiraSession,
  upsertUserJiraAccount,
};
