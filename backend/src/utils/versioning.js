const mongoose = require('mongoose');

const createEntityId = () => new mongoose.Types.ObjectId();

const normalizeKey = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-zA-Z0-9-_]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .toUpperCase();

const normalizeName = (value) => String(value || '').trim();

const pickPagination = (query) => {
  const page = Math.max(Number(query.page || 1), 1);
  const limitValue = Number(query.limit);
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : null;

  return { page, limit, skip: limit ? (page - 1) * limit : 0 };
};

const buildSearchMatch = (search, fields) => {
  const normalized = normalizeName(search);
  if (!normalized) {
    return {};
  }

  return {
    $or: fields.map((field) => ({ [field]: { $regex: normalized, $options: 'i' } })),
  };
};

const baseVersionFields = {
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    default: createEntityId,
    index: true,
  },
  versionNumber: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    index: true,
  },
  isLatest: {
    type: Boolean,
    default: true,
    index: true,
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true,
  },
  previousVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
  },
};

const applyVersioning = (schema, { scopeIndexes = [] } = {}) => {
  schema.add(baseVersionFields);

  schema.index(
    { entityId: 1, versionNumber: 1 },
    {
      unique: true,
      partialFilterExpression: {
        entityId: { $exists: true },
        versionNumber: { $exists: true },
      },
    }
  );

  scopeIndexes.forEach((indexSpec) => {
    // Avoid adding an index if the schema already declares the same index keys
    const existing = schema.indexes().map(([fields]) => fields || {});
    const normalize = (obj) => Object.keys(obj).sort().map((k) => `${k}:${obj[k]}`).join(',');
    const specKey = normalize(indexSpec.fields || {});
    const alreadyDeclared = existing.some((f) => normalize(f) === specKey);
    if (alreadyDeclared) return; // skip to avoid duplicate schema index warnings

    // Use an explicit name to avoid auto-generated name collisions in MongoDB
    const name = `v_${Object.keys(indexSpec.fields).join('_')}_latest`;

    schema.index(indexSpec.fields, {
      name,
      unique: true,
      partialFilterExpression: {
        deletedAt: null,
        isLatest: true,
        ...indexSpec.partialFilterExpression,
      },
    });
  });
};

module.exports = {
  applyVersioning,
  buildSearchMatch,
  createEntityId,
  normalizeKey,
  normalizeName,
  pickPagination,
};