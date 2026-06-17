const AuthRateLimit = require('../models/AuthRateLimit');
const {
  getLoginEmailConfig,
  getLoginIpConfig,
  getRegisterSuccessEmailConfig,
  getRegisterSuccessIpConfig,
} = require('../config/authRateLimitConfig');
const { httpError } = require('../utils/httpError');

function getConfigLimit(config) {
  return config.maxAttempts ?? config.maxSuccesses;
}

function buildRateLimitKey(rateLimitAction, scope, identifier) {
  return `${rateLimitAction}:${scope}:${identifier}`;
}

function computeRetryAfterSeconds(windowStartedAt, windowMs, now = new Date()) {
  const retryAfterMs = windowStartedAt.getTime() + windowMs - now.getTime();
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function isWindowActive(windowStartedAt, windowMs, now = new Date()) {
  return windowStartedAt.getTime() + windowMs > now.getTime();
}

async function getAuthRateLimitStatus({
  rateLimitAction,
  scope,
  identifier,
  maxAttempts,
  windowMs,
  now = new Date(),
}) {
  const key = buildRateLimitKey(rateLimitAction, scope, identifier);
  const windowCutoff = new Date(now.getTime() - windowMs);

  const active = await AuthRateLimit.findOne({
    key,
    windowStartedAt: { $gt: windowCutoff },
  });

  if (!active) {
    return {
      allowed: true,
      remaining: maxAttempts,
    };
  }

  if (active.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: computeRetryAfterSeconds(active.windowStartedAt, windowMs, now),
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - active.count),
  };
}

async function consumeAuthRateLimitBucket({
  rateLimitAction,
  scope,
  identifier,
  clientIp,
  email,
  maxAttempts,
  windowMs,
  now = new Date(),
}) {
  const key = buildRateLimitKey(rateLimitAction, scope, identifier);
  const windowCutoff = new Date(now.getTime() - windowMs);
  const expiresAt = new Date(now.getTime() + windowMs);

  const incremented = await AuthRateLimit.findOneAndUpdate(
    {
      key,
      windowStartedAt: { $gt: windowCutoff },
      count: { $lt: maxAttempts },
    },
    {
      $inc: { count: 1 },
      $set: {
        expiresAt,
        action: rateLimitAction,
        scope,
        clientIp,
        ...(email ? { email } : {}),
      },
    },
    { new: true },
  );

  if (incremented) {
    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - incremented.count),
    };
  }

  const blocked = await AuthRateLimit.findOne({
    key,
    windowStartedAt: { $gt: windowCutoff },
    count: { $gte: maxAttempts },
  });

  if (blocked) {
    return {
      allowed: false,
      retryAfterSeconds: computeRetryAfterSeconds(blocked.windowStartedAt, windowMs, now),
    };
  }

  await AuthRateLimit.findOneAndUpdate(
    { key },
    {
      $set: {
        action: rateLimitAction,
        scope,
        clientIp,
        ...(email ? { email } : {}),
        count: 1,
        windowStartedAt: now,
        expiresAt,
      },
    },
    { upsert: true },
  );

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - 1),
  };
}

async function releaseAuthRateLimitBucket({
  rateLimitAction,
  scope,
  identifier,
  now = new Date(),
}) {
  const key = buildRateLimitKey(rateLimitAction, scope, identifier);

  await AuthRateLimit.findOneAndUpdate(
    { key, count: { $gt: 0 } },
    { $inc: { count: -1 } },
  );
}

async function assertAuthRateLimitsAllowed({
  ipConfig,
  emailConfig,
  clientIp,
  email = '',
  now = new Date(),
}) {
  const ipStatus = await getAuthRateLimitStatus({
    rateLimitAction: ipConfig.rateLimitAction,
    scope: 'ip',
    identifier: clientIp,
    maxAttempts: getConfigLimit(ipConfig),
    windowMs: ipConfig.windowMs,
    now,
  });

  if (!ipStatus.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: ipStatus.retryAfterSeconds,
      blockedBy: 'ip',
    };
  }

  if (email) {
    const emailStatus = await getAuthRateLimitStatus({
      rateLimitAction: emailConfig.rateLimitAction,
      scope: 'email',
      identifier: email,
      maxAttempts: getConfigLimit(emailConfig),
      windowMs: emailConfig.windowMs,
      now,
    });

    if (!emailStatus.allowed) {
      return {
        allowed: false,
        retryAfterSeconds: emailStatus.retryAfterSeconds,
        blockedBy: 'email',
      };
    }

    return {
      allowed: true,
      remainingIp: ipStatus.remaining,
      remainingEmail: emailStatus.remaining,
    };
  }

  return {
    allowed: true,
    remainingIp: ipStatus.remaining,
  };
}

async function consumeAuthRateLimits({
  ipConfig,
  emailConfig,
  clientIp,
  email = '',
  now = new Date(),
}) {
  const allowed = await assertAuthRateLimitsAllowed({
    ipConfig,
    emailConfig,
    clientIp,
    email,
    now,
  });

  if (!allowed.allowed) {
    return allowed;
  }

  const ipConsumed = await consumeAuthRateLimitBucket({
    rateLimitAction: ipConfig.rateLimitAction,
    scope: 'ip',
    identifier: clientIp,
    clientIp,
    email: email || undefined,
    maxAttempts: getConfigLimit(ipConfig),
    windowMs: ipConfig.windowMs,
    now,
  });

  if (!ipConsumed.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: ipConsumed.retryAfterSeconds,
      blockedBy: 'ip',
    };
  }

  let emailConsumed = null;
  if (email) {
    emailConsumed = await consumeAuthRateLimitBucket({
      rateLimitAction: emailConfig.rateLimitAction,
      scope: 'email',
      identifier: email,
      clientIp,
      email,
      maxAttempts: getConfigLimit(emailConfig),
      windowMs: emailConfig.windowMs,
      now,
    });

    if (!emailConsumed.allowed) {
      await releaseAuthRateLimitBucket({
        rateLimitAction: ipConfig.rateLimitAction,
        scope: 'ip',
        identifier: clientIp,
        now,
      });

      return {
        allowed: false,
        retryAfterSeconds: emailConsumed.retryAfterSeconds,
        blockedBy: 'email',
      };
    }
  }

  return {
    allowed: true,
    remainingIp: ipConsumed.remaining,
    remainingEmail: emailConsumed?.remaining,
  };
}

async function consumeLoginRateLimits({ clientIp, email = '', now = new Date() }) {
  return consumeAuthRateLimits({
    ipConfig: getLoginIpConfig(),
    emailConfig: getLoginEmailConfig(),
    clientIp,
    email,
    now,
  });
}

async function assertRegisterCreationAllowed({ clientIp, email = '', now = new Date() }) {
  return assertAuthRateLimitsAllowed({
    ipConfig: getRegisterSuccessIpConfig(),
    emailConfig: getRegisterSuccessEmailConfig(),
    clientIp,
    email,
    now,
  });
}

async function reserveRegisterCreationQuota({ clientIp, email = '', now = new Date() }) {
  const result = await consumeAuthRateLimits({
    ipConfig: getRegisterSuccessIpConfig(),
    emailConfig: getRegisterSuccessEmailConfig(),
    clientIp,
    email,
    now,
  });

  if (!result.allowed) {
    throw httpError(
      429,
      result.blockedBy === 'email'
        ? 'Too many accounts created for this email. Please try again later.'
        : 'Too many accounts created from this network. Please try again later.',
      { retryAfterSeconds: result.retryAfterSeconds },
    );
  }

  return result;
}

async function releaseRegisterCreationQuota({ clientIp, email = '', now = new Date() }) {
  const ipConfig = getRegisterSuccessIpConfig();
  const emailConfig = getRegisterSuccessEmailConfig();

  await releaseAuthRateLimitBucket({
    rateLimitAction: ipConfig.rateLimitAction,
    scope: 'ip',
    identifier: clientIp,
    now,
  });

  if (email) {
    await releaseAuthRateLimitBucket({
      rateLimitAction: emailConfig.rateLimitAction,
      scope: 'email',
      identifier: email,
      now,
    });
  }
}

/** @deprecated use consumeLoginRateLimits */
async function consumeAuthRateLimitsForAuth({ action, clientIp, email = '', now = new Date() }) {
  if (action !== 'login') {
    throw new Error(`consumeAuthRateLimitsForAuth only supports login attempts, got: ${action}`);
  }

  return consumeLoginRateLimits({ clientIp, email, now });
}

module.exports = {
  assertRegisterCreationAllowed,
  buildRateLimitKey,
  computeRetryAfterSeconds,
  consumeAuthRateLimitBucket,
  consumeAuthRateLimits,
  consumeAuthRateLimitsForAuth,
  consumeLoginRateLimits,
  getAuthRateLimitStatus,
  isWindowActive,
  releaseRegisterCreationQuota,
  reserveRegisterCreationQuota,
};
