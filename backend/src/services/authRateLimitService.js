const AuthRateLimit = require('../models/AuthRateLimit');
const {
  getAuthRateLimitEmailConfig,
  getAuthRateLimitIpConfig,
} = require('../config/authRateLimitConfig');

function buildRateLimitKey(action, scope, identifier) {
  return `${action}:${scope}:${identifier}`;
}

function computeRetryAfterSeconds(windowStartedAt, windowMs, now = new Date()) {
  const retryAfterMs = windowStartedAt.getTime() + windowMs - now.getTime();
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

function isWindowActive(windowStartedAt, windowMs, now = new Date()) {
  return windowStartedAt.getTime() + windowMs > now.getTime();
}

async function getAuthRateLimitStatus({
  action,
  scope,
  identifier,
  maxAttempts,
  windowMs,
  now = new Date(),
}) {
  const key = buildRateLimitKey(action, scope, identifier);
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
  action,
  scope,
  identifier,
  clientIp,
  email,
  maxAttempts,
  windowMs,
  now = new Date(),
}) {
  const key = buildRateLimitKey(action, scope, identifier);
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
        action,
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
        action,
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

async function consumeAuthRateLimitsForAuth({
  action,
  clientIp,
  email = '',
  now = new Date(),
}) {
  const ipConfig = getAuthRateLimitIpConfig(action);
  const emailConfig = getAuthRateLimitEmailConfig(action);

  const ipStatus = await getAuthRateLimitStatus({
    action,
    scope: 'ip',
    identifier: clientIp,
    maxAttempts: ipConfig.maxAttempts,
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
      action,
      scope: 'email',
      identifier: email,
      maxAttempts: emailConfig.maxAttempts,
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
  }

  const ipConsumed = await consumeAuthRateLimitBucket({
    action,
    scope: 'ip',
    identifier: clientIp,
    clientIp,
    email: email || undefined,
    maxAttempts: ipConfig.maxAttempts,
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
      action,
      scope: 'email',
      identifier: email,
      clientIp,
      email,
      maxAttempts: emailConfig.maxAttempts,
      windowMs: emailConfig.windowMs,
      now,
    });

    if (!emailConsumed.allowed) {
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

/** @deprecated use consumeAuthRateLimitsForAuth */
async function consumeAuthRateLimit({ action, clientIp, maxAttempts, windowMs, now = new Date() }) {
  return consumeAuthRateLimitBucket({
    action,
    scope: 'ip',
    identifier: clientIp,
    clientIp,
    maxAttempts,
    windowMs,
    now,
  });
}

module.exports = {
  buildRateLimitKey,
  computeRetryAfterSeconds,
  consumeAuthRateLimit,
  consumeAuthRateLimitBucket,
  consumeAuthRateLimitsForAuth,
  getAuthRateLimitStatus,
  isWindowActive,
};
