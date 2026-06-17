const buildTestPlanServices = ({
  mongoose,
  Project,
  Version,
  TestPlan,
  httpError,
  normalizeKey,
  normalizeName,
  createEntityId,
  activeLatestFilter,
  toObjectId,
  buildVersionedList,
  getVersionHistory,
  ensureProjectExists,
  ensureVersionExists,
  resolveTestCaseByReference,
  extractReferenceId,
  attachTestPlanCases,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
  isPlanAssignedToUser,
}) => {
  const createTestPlanService = async ({
    name,
    key,
    description,
    projectId,
    versionId,
    caseIds,
    ownerId,
    assigneeIds,
    executionMode,
    createdBy,
  }) => {
    const project = await ensureProjectExists(projectId);
    const releaseVersion = await ensureVersionExists(versionId, project._id);
    const normalizedKey = normalizeKey(key || name);
    const normalizedName = normalizeName(name);
    const projectRefs = [String(project._id), String(project.entityId || '')].filter(Boolean);
    const versionRefs = [String(releaseVersion._id), String(releaseVersion.entityId || '')].filter(Boolean);

    const duplicate = await TestPlan.findOne({
      project: { $in: projectRefs },
      version: { $in: versionRefs },
      deletedAt: null,
      isLatest: true,
      $or: [{ key: normalizedKey }, { name: normalizedName }],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test plan name or key already exists in this release version');
    }

    const allowedProjectRefs = new Set(projectRefs);
    const validCaseIds = [];
    for (let index = 0; index < caseIds.length; index += 1) {
      const testCase = await resolveTestCaseByReference(caseIds[index], { includeDeleted: false });
      if (!testCase) {
        throw httpError(400, 'Some caseIds do not exist in selected project');
      }

      const caseProjectRef = extractReferenceId(testCase.project);
      if (!allowedProjectRefs.has(String(caseProjectRef))) {
        throw httpError(400, 'Some caseIds do not exist in selected project');
      }

      validCaseIds.push({
        testCase: testCase.entityId || testCase._id,
        testCaseVersionId: testCase._id,
        order: index + 1,
        owner: ownerId ? toObjectId(ownerId, 'ownerId') : undefined,
        assignees: Array.isArray(assigneeIds)
          ? assigneeIds.map((id, assigneeIndex) => toObjectId(id, `assigneeIds[${assigneeIndex}]`))
          : [],
      });
    }

    const testPlan = await TestPlan.create({
      entityId: createEntityId(),
      versionNumber: 1,
      isLatest: true,
      deletedAt: null,
      key: normalizedKey,
      name: normalizedName,
      description: description || '',
      project: project.entityId ? project.entityId : project._id,
      projectVersionId: project._id,
      version: releaseVersion.entityId ? releaseVersion.entityId : releaseVersion._id,
      versionVersionId: releaseVersion._id,
      createdBy,
      owner: ownerId ? toObjectId(ownerId, 'ownerId') : undefined,
      assignees: Array.isArray(assigneeIds)
        ? assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`))
        : [],
      executionMode: executionMode === 'automation' ? 'automation' : 'manual',
      items: validCaseIds,
    });

    const normalizedPlan = await attachTestPlanCases(
      await TestPlan.findById(testPlan._id)
        .populate('project', 'entityId name code deletedAt')
        .populate('version', 'entityId name deletedAt')
        .populate('owner', 'name email role')
        .populate('assignees', 'name email role')
        .lean(),
    );

    return normalizedPlan;
  };

  const listTestPlansService = async (query = {}, user = null) => {
    const {
      projectId, versionId, search, includeDeleted,
    } = query;
    const baseFilters = {};
    let resolvedProject = null;

    if (projectId) {
      try {
        resolvedProject = await ensureProjectExists(projectId);
      } catch (error) {
        if (error.statusCode === 404) {
          return { testPlans: [], pagination: null };
        }
        throw error;
      }
    } else {
      const activeProjectRefs = await Project.find({ deletedAt: null }).select('_id entityId').lean();
      const activeProjectIds = Array.from(new Set(
        activeProjectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
      ));
      baseFilters.project = { $in: activeProjectIds.map((v) => toObjectId(v, 'projectId')) };
    }

    if (resolvedProject) {
      const projectRefs = await Project.find({ entityId: resolvedProject.entityId }).select('_id entityId').lean();
      const projectIds = Array.from(new Set(
        projectRefs.flatMap((project) => [String(project._id), String(project.entityId || '')]).filter(Boolean),
      ));
      baseFilters.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
    }

    if (versionId) {
      let version;
      try {
        if (resolvedProject) {
          version = await ensureVersionExists(versionId, resolvedProject._id);
        } else {
          version = await Version.findOne({
            $or: [
              { entityId: toObjectId(versionId, 'versionId') },
              { _id: toObjectId(versionId, 'versionId') },
            ],
            ...activeLatestFilter(),
            deletedAt: null,
          }).lean();
          if (!version) {
            throw httpError(404, 'Version not found');
          }
        }
      } catch (error) {
        if (error.statusCode === 404) {
          return { testPlans: [], pagination: null };
        }
        throw error;
      }
      const versionRefs = [String(version._id)];
      if (version.entityId) versionRefs.push(String(version.entityId));
      baseFilters.version = { $in: versionRefs.map((v) => toObjectId(v, 'versionId')) };
    }
    const { docs: testPlans, pagination } = await buildVersionedList({
      model: TestPlan,
      query,
      search,
      searchFields: ['key', 'name', 'description'],
      baseFilters,
      populate: [
        { path: 'owner', select: 'name email role' },
        { path: 'assignees', select: 'name email role' },
      ],
      includeDeleted: includeDeleted === 'true',
    });

    const referencedProjectIds = Array.from(new Set(testPlans.map((p) => extractReferenceId(p.project)).filter(Boolean)));
    let attachedProjects = [];
    if (referencedProjectIds.length > 0) {
      const referencedProjectObjectIds = referencedProjectIds.filter((v) => mongoose.Types.ObjectId.isValid(v));
      attachedProjects = await Project.find({
        $or: [
          { _id: { $in: referencedProjectObjectIds.map((v) => toObjectId(v, 'projectId')) } },
          { entityId: { $in: referencedProjectObjectIds.map((v) => toObjectId(v, 'projectId')) } },
        ],
      }).select('entityId name code deletedAt').lean();
    }
    const projectMap = new Map();
    for (const p of attachedProjects) {
      projectMap.set(String(p._id), p);
      if (p.entityId) projectMap.set(String(p.entityId), p);
    }

    const referencedVersionIds = Array.from(new Set(testPlans.map((p) => extractReferenceId(p.version)).filter(Boolean)));
    let latestVersionByRef = new Map();
    if (referencedVersionIds.length > 0) {
      const referencedVersionObjectIds = referencedVersionIds.filter((v) => mongoose.Types.ObjectId.isValid(v));
      const referencedVersions = await Version.find({
        $or: [
          { _id: { $in: referencedVersionObjectIds.map((v) => toObjectId(v, 'versionId')) } },
          { entityId: { $in: referencedVersionObjectIds.map((v) => toObjectId(v, 'versionId')) } },
        ],
      }).select('entityId _id').lean();

      const versionEntityIds = Array.from(new Set(
        referencedVersions.map((version) => String(version.entityId || version._id)).filter(Boolean),
      ));

      const latestVersions = versionEntityIds.length > 0
        ? await Version.find({
          entityId: { $in: versionEntityIds.map((value) => toObjectId(value, 'versionId')) },
          ...activeLatestFilter(),
        }).select('entityId name deletedAt _id').lean()
        : [];

      const latestByEntityId = new Map(
        latestVersions.map((version) => [String(version.entityId || version._id), version]),
      );

      for (const snapshot of referencedVersions) {
        const latest = latestByEntityId.get(String(snapshot.entityId || snapshot._id));
        if (!latest) {
          continue;
        }
        latestVersionByRef.set(String(snapshot._id), latest);
        if (snapshot.entityId) {
          latestVersionByRef.set(String(snapshot.entityId), latest);
        }
      }
    }

    const normalizedPlans = testPlans.map((plan) => ({
      ...plan,
      project: projectMap.get(extractReferenceId(plan.project)) || plan.project || null,
      version: latestVersionByRef.get(extractReferenceId(plan.version)) || plan.version || null,
    }));

    const attachedPlans = await Promise.all(normalizedPlans.map((plan) => attachTestPlanCases(plan)));

    const visiblePlans = user?.role === 'admin' || !user
      ? attachedPlans
      : attachedPlans.filter((plan) => isPlanAssignedToUser(plan, user.id));

    return { testPlans: visiblePlans, pagination };
  };

  const getTestPlanService = async (testPlanId) => {
    const testPlan = await TestPlan.findOne({
      entityId: toObjectId(testPlanId, 'testPlanId'),
      isLatest: true,
      deletedAt: null,
    })
      .populate('project', 'entityId name code deletedAt')
      .populate('version', 'entityId name deletedAt')
      .populate('owner', 'name email role')
      .populate('assignees', 'name email role')
      .lean();
    if (!testPlan) {
      return null;
    }

    return attachTestPlanCases(testPlan);
  };

  const getTestPlanVersionsService = async (testPlanId) => {
    try {
      const versions = await getVersionHistory(TestPlan, testPlanId);
      return versions;
    } catch (err) {
      if (err?.statusCode === 404) {
        return [];
      }
      throw err;
    }
  };

  const assignTestPlanItemsService = async (testPlanId, { assigneeIds, ownerId }, userId) => {
    const nextTestPlan = await updateVersionedDocument(TestPlan, testPlanId, async (current) => ({
      key: current.key || normalizeKey(current.name || `PLAN-${String(current._id).slice(-6)}`),
      name: current.name || current.key || 'Untitled Test Plan',
      description: current.description,
      project: current.project,
      version: current.version,
      executionMode: current.executionMode || 'manual',
      owner: ownerId ? toObjectId(ownerId, 'ownerId') : toObjectId(userId, 'ownerId'),
      assignees: assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`)),
      items: current.items,
      createdBy: current.createdBy || userId,
    }));

    const populated = await TestPlan.findById(nextTestPlan._id)
      .populate('project', 'entityId name code deletedAt')
      .populate('version', 'entityId name deletedAt')
      .populate('owner', 'name email role')
      .populate('assignees', 'name email role')
      .lean();

    return attachTestPlanCases(populated);
  };

  const updateTestPlanService = async (
    testPlanId,
    {
      name,
      key,
      description,
      projectId,
      versionId,
      caseIds,
      ownerId,
      assigneeIds,
      executionMode,
    },
    userId,
  ) => {
    const nextTestPlan = await updateVersionedDocument(TestPlan, testPlanId, async (current) => {
      const nextProjectId = projectId ? toObjectId(projectId, 'projectId') : current.project;
      const nextVersionId = versionId ? toObjectId(versionId, 'versionId') : current.version;

      const project = await ensureProjectExists(nextProjectId, { includeDeleted: false });
      const version = await ensureVersionExists(nextVersionId, nextProjectId, { includeDeleted: false });
      const projectRefs = [String(project._id), String(project.entityId || '')].filter(Boolean);
      const versionRefs = [String(version._id), String(version.entityId || '')].filter(Boolean);

      const normalizedName = name ? normalizeName(name) : current.name;
      const normalizedKey = normalizeKey(key || current.key || current.name);

      const duplicate = await TestPlan.findOne({
        _id: { $ne: current._id },
        project: { $in: projectRefs },
        version: { $in: versionRefs },
        deletedAt: null,
        isLatest: true,
        $or: [{ key: normalizedKey }, { name: normalizedName }],
      }).lean();
      if (duplicate) {
        throw httpError(409, 'Test plan name or key already exists in this release version');
      }

      const resolvedName = name ? normalizeName(name) : (current.name || current.key || 'Untitled Test Plan');
      const resolvedKey = normalizeKey(key || current.key || current.name || `PLAN-${String(current._id).slice(-6)}`);
      let items = current.items;
      if (Array.isArray(caseIds) && caseIds.length > 0) {
        items = [];
        const allowedProjectRefs = new Set([
          String(project._id),
          String(project.entityId || ''),
        ].filter(Boolean));
        for (let index = 0; index < caseIds.length; index += 1) {
          const testCase = await resolveTestCaseByReference(caseIds[index], { includeDeleted: false });
          if (!testCase) {
            throw httpError(400, 'Some caseIds do not exist in selected project');
          }

          const caseProjectRef = extractReferenceId(testCase.project);
          if (!allowedProjectRefs.has(String(caseProjectRef))) {
            throw httpError(400, 'Some caseIds do not exist in selected project');
          }

          items.push({
            testCase: testCase.entityId || testCase._id,
            testCaseVersionId: testCase._id,
            order: index + 1,
            owner: ownerId ? toObjectId(ownerId, 'ownerId') : current.owner,
            assignees: Array.isArray(assigneeIds)
              ? assigneeIds.map((id, assigneeIndex) => toObjectId(id, `assigneeIds[${assigneeIndex}]`))
              : current.assignees,
          });
        }
      }

      return {
        key: resolvedKey,
        name: resolvedName,
        description: description !== undefined ? description || '' : current.description,
        project: nextProjectId,
        projectVersionId: project._id,
        version: nextVersionId,
        versionVersionId: version._id,
        owner: ownerId ? toObjectId(ownerId, 'ownerId') : current.owner,
        assignees: Array.isArray(assigneeIds)
          ? assigneeIds.map((id, index) => toObjectId(id, `assigneeIds[${index}]`))
          : current.assignees,
        executionMode: executionMode === 'automation' || executionMode === 'manual'
          ? executionMode
          : (current.executionMode || 'manual'),
        items,
        createdBy: current.createdBy || userId,
      };
    });

    const populated = await TestPlan.findById(nextTestPlan._id)
      .populate('project', 'entityId name code deletedAt')
      .populate('version', 'entityId name deletedAt')
      .populate('owner', 'name email role')
      .populate('assignees', 'name email role')
      .lean();

    return attachTestPlanCases(populated);
  };

  const deleteTestPlanService = async (testPlanId) => {
    await softDeleteVersionSeries(TestPlan, testPlanId);
  };

  const restoreTestPlanService = async (testPlanId) => {
    const current = await TestPlan.findOne({ entityId: toObjectId(testPlanId, 'testPlanId') }).lean();
    if (!current) {
      throw httpError(404, 'Test plan not found');
    }

    const project = await ensureProjectExists(current.project, { includeDeleted: true });
    const version = await ensureVersionExists(current.version, project._id, { includeDeleted: true });

    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectRefs = Array.from(
      new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'projectId'));

    const versionVersionIds = await Version.find({ entityId: version.entityId }).distinct('_id');
    const versionRefs = Array.from(
      new Set([...(versionVersionIds || []), version.entityId, version._id].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'versionId'));

    const duplicate = await TestPlan.findOne({
      _id: { $ne: current._id },
      project: { $in: projectRefs },
      version: { $in: versionRefs },
      $and: [
        activeLatestFilter(),
        { $or: [{ key: current.key }, { name: current.name }] },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test plan name or key already exists in this release version');
    }

    await restoreVersionSeries(TestPlan, testPlanId);
    const testPlan = await TestPlan.findOne({ entityId: toObjectId(testPlanId, 'testPlanId') })
      .populate('project', 'entityId name code deletedAt')
      .populate('version', 'entityId name deletedAt')
      .populate('owner', 'name email role')
      .populate('assignees', 'name email role')
      .lean();
    return attachTestPlanCases(testPlan);
  };

  return {
    createTestPlanService,
    listTestPlansService,
    getTestPlanService,
    getTestPlanVersionsService,
    assignTestPlanItemsService,
    updateTestPlanService,
    deleteTestPlanService,
    restoreTestPlanService,
  };
};

module.exports = {
  buildTestPlanServices,
};
