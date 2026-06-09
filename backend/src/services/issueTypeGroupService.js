const buildIssueTypeGroupServices = ({
  mongoose,
  Project,
  IssueType,
  TestCaseGroup,
  httpError,
  normalizeName,
  normalizeKey,
  buildSearchMatch,
  createEntityId,
  buildVersionedList,
  extractReferenceId,
  activeLatestFilter,
  toObjectId,
  ensureProjectExists,
  resolveLatestProjectSnapshot,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
  getVersionHistory,
}) => {
  const createIssueTypeService = async ({ name, idjira, createdBy }) => {
    const normalizedName = normalizeName(name);
    const normalizedIdJira = String(idjira).trim();

    const duplicate = await IssueType.findOne({
      deletedAt: null,
      $or: [{ name: normalizedName }, { idjira: normalizedIdJira }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Issue type name or Jira id already exists');
    }

    return IssueType.create({
      name: normalizedName,
      idjira: normalizedIdJira,
      createdBy,
    });
  };

  const listIssueTypesService = async ({ search, includeDeleted }) => {
    const filters = [];

    if (includeDeleted !== 'true') {
      filters.push({ deletedAt: null });
    }

    if (search) {
      filters.push(buildSearchMatch(search, ['name', 'idjira']));
    }

    const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
    return IssueType.find(match).sort({ createdAt: -1 }).lean();
  };

  const getIssueTypeService = async (issueTypeId) => {
    const issueType = await IssueType.findById(toObjectId(issueTypeId, 'issueTypeId')).lean();
    if (!issueType) {
      throw httpError(404, 'Issue type not found');
    }

    return issueType;
  };

  const updateIssueTypeService = async (issueTypeId, payload) => {
    const { name, idjira } = payload;
    const issueType = await IssueType.findById(toObjectId(issueTypeId, 'issueTypeId'));
    if (!issueType) {
      throw httpError(404, 'Issue type not found');
    }

    if (issueType.deletedAt) {
      throw httpError(409, 'Restore the issue type before editing it');
    }

    if (name !== undefined) issueType.name = normalizeName(name);
    if (idjira !== undefined) issueType.idjira = String(idjira || '').trim();

    if (!issueType.name || !issueType.idjira) {
      throw httpError(400, 'name and idjira are required');
    }

    const duplicate = await IssueType.findOne({
      _id: { $ne: issueType._id },
      deletedAt: null,
      $or: [{ name: issueType.name }, { idjira: issueType.idjira }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Issue type name or Jira id already exists');
    }

    await issueType.save();
    return issueType;
  };

  const deleteIssueTypeService = async (issueTypeId) => {
    const issueType = await IssueType.findById(toObjectId(issueTypeId, 'issueTypeId'));
    if (!issueType) {
      throw httpError(404, 'Issue type not found');
    }

    issueType.deletedAt = new Date();
    await issueType.save();
  };

  const createTestCaseGroupService = async ({ projectId, name, key, description, createdBy }) => {
    const project = await resolveLatestProjectSnapshot(projectId);
    const normalizedName = normalizeName(name);
    const normalizedKey = normalizeKey(key || name);
    const projectRef = project.entityId || project._id;
    const projectVersionId = project._id;

    const duplicate = await TestCaseGroup.findOne({
      project: { $in: [project._id, project.entityId].filter(Boolean) },
      deletedAt: null,
      isLatest: true,
      $or: [{ key: normalizedKey }, { name: normalizedName }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case group name or key already exists in this project');
    }

    return TestCaseGroup.create({
      entityId: createEntityId(),
      versionNumber: 1,
      isLatest: true,
      deletedAt: null,
      project: projectRef,
      projectVersionId,
      key: normalizedKey,
      name: normalizedName,
      description: description || '',
      createdBy,
    });
  };

  const listTestCaseGroupsService = async ({ query, projectId, search, includeDeleted }) => {
    const baseFilters = {};

    if (projectId) {
      const project = await resolveLatestProjectSnapshot(projectId);
      try {
        const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
        const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
        baseFilters.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
      } catch (err) {
        baseFilters.project = { $in: [project._id, project.entityId].filter(Boolean) };
      }
    } else {
      const activeProjects = await Project.find({ deletedAt: null }).select('_id entityId').lean();
      const activeProjectIds = Array.from(
        new Set(activeProjects.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean)),
      );
      baseFilters.project = { $in: activeProjectIds.map((value) => toObjectId(value, 'projectId')) };
    }

    const { docs: groups, pagination } = await buildVersionedList({
      model: TestCaseGroup,
      query,
      search,
      searchFields: ['key', 'name', 'description'],
      baseFilters,
      populate: [],
      includeDeleted: includeDeleted === 'true',
    });

    const referencedIds = Array.from(new Set(groups.map((g) => extractReferenceId(g.project)).filter(Boolean)));
    let attachedProjects = [];
    if (referencedIds.length > 0) {
      const referencedObjectIds = referencedIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
      attachedProjects = await Project.find({
        $or: [
          { _id: { $in: referencedObjectIds.map((v) => toObjectId(v, 'projectId')) } },
          { entityId: { $in: referencedObjectIds.map((v) => toObjectId(v, 'projectId')) } },
        ],
      }).select('entityId name code deletedAt').lean();
    }

    const projectMap = new Map();
    for (const p of attachedProjects) {
      projectMap.set(String(p._id), p);
      if (p.entityId) projectMap.set(String(p.entityId), p);
    }

    const normalizedGroups = groups.map((g) => {
      const gp = projectMap.get(extractReferenceId(g.project)) || null;
      return {
        ...g,
        project: gp || g.project || null,
      };
    });

    return { groups: normalizedGroups, pagination };
  };

  const getTestCaseGroupService = async (groupId) => TestCaseGroup.findOne({
    entityId: toObjectId(groupId, 'groupId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  })
    .populate('project', 'entityId name code deletedAt')
    .lean();

  const getTestCaseGroupVersionsService = async (groupId) => {
    try {
      const versions = await getVersionHistory(TestCaseGroup, groupId);
      return versions;
    } catch (err) {
      return [];
    }
  };

  const updateTestCaseGroupService = async (groupId, { projectId, key, name, description }) => updateVersionedDocument(
    TestCaseGroup,
    groupId,
    async (current) => {
      let nextProject;
      if (projectId) {
        nextProject = await resolveLatestProjectSnapshot(projectId, { includeDeleted: false });
      } else {
        nextProject = await resolveLatestProjectSnapshot(current.project, { includeDeleted: false });
      }

      const nextProjectRef = nextProject.entityId || nextProject._id;
      const nextProjectVersionId = nextProject._id;

      const normalizedName = name ? normalizeName(name) : current.name;
      const normalizedKey = normalizeKey(key || current.key || current.name);

      const duplicate = await TestCaseGroup.findOne({
        _id: { $ne: current._id },
        project: { $in: [nextProjectRef, nextProjectVersionId].filter(Boolean) },
        deletedAt: null,
        isLatest: true,
        $or: [{ key: normalizedKey }, { name: normalizedName }],
      }).lean();
      if (duplicate) {
        throw httpError(409, 'Test case group name or key already exists in this project');
      }

      return {
        project: nextProjectRef,
        projectVersionId: nextProjectVersionId,
        key: normalizedKey,
        name: normalizedName,
        description: description !== undefined ? description || '' : current.description,
        createdBy: current.createdBy,
      };
    },
  );

  const deleteTestCaseGroupService = async (groupId) => {
    await softDeleteVersionSeries(TestCaseGroup, groupId);
  };

  const restoreTestCaseGroupService = async (groupId) => {
    const current = await TestCaseGroup.findOne({ entityId: toObjectId(groupId, 'groupId') }).lean();
    if (!current) {
      throw httpError(404, 'Test case group not found');
    }

    const project = await ensureProjectExists(current.project, { includeDeleted: true });
    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectRefs = Array.from(
      new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'projectId'));

    const duplicate = await TestCaseGroup.findOne({
      _id: { $ne: current._id },
      project: { $in: projectRefs },
      $and: [
        activeLatestFilter(),
        { $or: [{ key: current.key }, { name: current.name }] },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case group name or key already exists in this project');
    }

    await restoreVersionSeries(TestCaseGroup, groupId);
    return TestCaseGroup.findOne({ entityId: toObjectId(groupId, 'groupId') }).lean();
  };

  return {
    createIssueTypeService,
    listIssueTypesService,
    getIssueTypeService,
    updateIssueTypeService,
    deleteIssueTypeService,
    createTestCaseGroupService,
    listTestCaseGroupsService,
    getTestCaseGroupService,
    getTestCaseGroupVersionsService,
    updateTestCaseGroupService,
    deleteTestCaseGroupService,
    restoreTestCaseGroupService,
  };
};

module.exports = {
  buildIssueTypeGroupServices,
};
