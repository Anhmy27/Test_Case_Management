const mongoose = require('mongoose');
const { httpError } = require('../../utils/httpError');
const {
  buildSearchMatch,
  createEntityId,
  pickPagination,
} = require('../../utils/versioning');
const { isPlanAssignedToUser } = require('../../utils/entityResolvers');

const activeLatestFilter = () => ({
  deletedAt: null,
  $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
});

const toObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(id);
};

const objectIdString = (value) => String(value || '');

const extractReferenceId = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }

    const candidate = value.entityId || value._id || value.id;
    return candidate ? String(candidate) : '';
  }

  return '';
};

const normalizeStepExpected = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

const normalizeManualSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && String(step.action || '').trim())
    .map((step, index) => ({
      order: index + 1,
      action: String(step.action).trim(),
      expected: normalizeStepExpected(step.expected),
    }));
};

const normalizeOverallExpected = (value) => String(value || '').trim();

const { normalizeTimeoutInputMs, normalizeGotoWaitUntil } = require('../../utils/automationTimeouts');

const normalizeAutomationSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .filter((step) => step && String(step.action || '').trim())
    .map((step, index) => {
      const optionalTimeoutMs = normalizeTimeoutInputMs(step.timeoutMs);
      const normalized = {
        stepId: String(step.stepId || '').trim() || String(index + 1),
        stepName: String(step.stepName || '').trim(),
        order: index + 1,
        action: String(step.action || 'goto').trim(),
        targetType: String(step.targetType || 'css').trim(),
        target: String(step.target || '').trim(),
        value: String(step.value || '').trim(),
        expected: String(step.expected || '').trim(),
      };

      if (optionalTimeoutMs !== null) {
        normalized.timeoutMs = optionalTimeoutMs;
      }

      const action = normalized.action.toLowerCase();
      if (action === 'goto') {
        const waitUntil = normalizeGotoWaitUntil(step.waitUntil);
        if (waitUntil === 'domcontentloaded') {
          normalized.waitUntil = 'domcontentloaded';
        }
      }

      return normalized;
    });
};

const applyPopulate = (query, populate = []) => {
  for (const entry of populate) {
    query.populate(entry);
  }

  return query;
};

const buildVersionedList = async ({
  model,
  query,
  search,
  searchFields,
  baseFilters = {},
  populate = [],
  sort = { createdAt: -1 },
  includeDeleted = false,
}) => {
  const { page, limit, skip } = pickPagination(query);
  const filters = [];

  Object.entries(baseFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      filters.push({ [key]: value });
    }
  });

  if (!includeDeleted) {
    filters.push(activeLatestFilter());
  }

  if (search) {
    const searchMatch = buildSearchMatch(search, searchFields);
    if (Object.keys(searchMatch).length > 0) {
      filters.push(searchMatch);
    }
  }

  const match = filters.length === 0
    ? {}
    : filters.length === 1
      ? filters[0]
      : { $and: filters };

  const countPromise = model.countDocuments(match);
  let docsQuery = model.find(match).sort(sort);
  if (limit) {
    docsQuery = docsQuery.skip(skip).limit(limit);
  }

  docsQuery = applyPopulate(docsQuery, populate);

  const [total, docs] = await Promise.all([
    countPromise,
    docsQuery.lean(),
  ]);

  return {
    docs,
    pagination: limit
      ? {
          page,
          limit,
          total,
          pages: Math.max(Math.ceil(total / limit), 1),
        }
      : null,
  };
};

const createVersionedDocument = async (Model, payload, session) => {
  const [doc] = await Model.create([
    {
      ...payload,
      entityId: payload.entityId || createEntityId(),
      versionNumber: payload.versionNumber || 1,
      isLatest: payload.isLatest !== undefined ? payload.isLatest : true,
      deletedAt: payload.deletedAt || null,
      previousVersionId: payload.previousVersionId || null,
    },
  ], session ? { session } : undefined);

  return doc;
};

const findVersionedCurrentDocument = async (Model, currentId, { includeDeleted = false } = {}) => {
  const objectId = toObjectId(currentId, 'entityId');
  const query = {
    $and: [
      {
        $or: [
          { entityId: objectId },
          { _id: objectId },
        ],
      },
    ],
  };

  if (!includeDeleted) {
    query.$and.push({ $or: [{ isLatest: true }, { isLatest: { $exists: false } }] });
    query.$and.push({ deletedAt: null });
  }

  return Model.findOne(query);
};

const updateVersionedDocument = async (Model, currentId, buildNextPayload) => {
  const current = await findVersionedCurrentDocument(Model, currentId);
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  if (current.deletedAt) {
    throw httpError(409, 'Deleted records must be restored before editing');
  }

  if (current.isLatest === false) {
    throw httpError(409, 'Historical versions cannot be edited directly');
  }

  const originalIsLatest = current.isLatest;
  current.isLatest = false;
  await current.save();

  try {
    const nextPayload = await buildNextPayload(current.toObject({ depopulate: true }));
    const next = await createVersionedDocument(
      Model,
      {
        ...nextPayload,
        entityId: current.entityId,
        versionNumber: Number(current.versionNumber || 1) + 1,
        previousVersionId: current._id,
      },
    );

    return next;
  } catch (error) {
    current.isLatest = originalIsLatest;
    await current.save();
    throw error;
  }
};

const softDeleteVersionSeries = async (Model, id) => {
  const current = await findVersionedCurrentDocument(Model, id, { includeDeleted: true });
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  const deletedAt = new Date();

  await Model.updateMany({ entityId }, { $set: { deletedAt } });
};

const restoreVersionSeries = async (Model, id) => {
  const current = await findVersionedCurrentDocument(Model, id, { includeDeleted: true });
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  await Model.updateMany({ entityId }, { $set: { deletedAt: null } });
};

const getVersionHistory = async (Model, id) => {
  const current = await findVersionedCurrentDocument(Model, id, { includeDeleted: true });
  if (!current) {
    throw httpError(404, 'Entity not found');
  }

  const entityId = current.entityId || current._id;
  return Model.find({ entityId }).sort({ versionNumber: 1 }).lean();
};


module.exports = {
  activeLatestFilter,
  toObjectId,
  objectIdString,
  extractReferenceId,
  normalizeStepExpected,
  normalizeManualSteps,
  normalizeOverallExpected,
  normalizeAutomationSteps,
  buildVersionedList,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
  getVersionHistory,
  isPlanAssignedToUser,
};
