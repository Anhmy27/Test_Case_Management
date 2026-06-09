const buildProjectVersionServices = ({
  mongoose,
  Project,
  Version,
  TestCaseGroup,
  TestCase,
  TestPlan,
  TestRun,
  httpError,
  repointVersionReferences,
  normalizeKey,
  normalizeName,
  buildSearchMatch,
  activeLatestFilter,
  toObjectId,
  ensureProjectExists,
  resolveLatestProjectSnapshot,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
}) => {
  const createProjectService = async ({
    name,
    code,
    description,
    pid,
    jiraProjectKey,
    jiraProductKey,
    createdBy,
  }) => {
    const normalizedName = normalizeName(name);
    const normalizedCode = normalizeKey(code);
    const incomingJiraProjectKey = jiraProjectKey !== undefined ? jiraProjectKey : jiraProductKey;

    const existingProject = await Project.findOne({
      $and: [
        activeLatestFilter(),
        { $or: [{ code: normalizedCode }, { name: normalizedName }] },
      ],
    }).lean();
    if (existingProject) {
      throw httpError(409, 'Project name or code already exists');
    }

    const project = await Project.create({
      name: normalizedName,
      code: normalizedCode,
      pid: pid ? String(pid).trim() : '',
      jiraProjectKey: incomingJiraProjectKey ? String(incomingJiraProjectKey).trim() : '',
      description: description || '',
      createdBy,
    });

    return project;
  };

  const listProjectsService = async ({ search, includeDeleted }) => {
    const filters = [];

    if (includeDeleted !== 'true') {
      filters.push({ deletedAt: null });
    }

    if (search) {
      filters.push(buildSearchMatch(search, ['name', 'code', 'description']));
    }

    filters.push({
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    });

    const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
    const projects = await Project.find(match).sort({ createdAt: -1 }).lean();

    const projectsWithLatestVersion = await Promise.all(
      projects.map(async (project) => {
        const projectRefs = await Project.find({ entityId: project.entityId }).select('_id entityId').lean();
        const projectObjectIds = Array.from(
          new Set(
            projectRefs
              .flatMap((item) => [String(item._id), String(item.entityId || '')])
              .filter(Boolean),
          ),
        ).map((value) => toObjectId(value, 'projectId'));

        const latestVersion = await Version.findOne({
          $and: [
            {
              $or: [
                { project: { $in: projectObjectIds } },
                { projectVersionId: { $in: projectObjectIds } },
              ],
            },
            { deletedAt: null },
            { $or: [{ isLatest: true }, { isLatest: { $exists: false } }] },
          ],
        })
          .sort({ createdAt: -1 })
          .select('entityId name')
          .lean();

        return {
          ...project,
          latestVersion: latestVersion
            ? {
                _id: String(latestVersion.entityId || latestVersion._id),
                name: latestVersion.name,
              }
            : null,
        };
      }),
    );

    return projectsWithLatestVersion;
  };

  const getProjectService = async (projectId) => Project.findOne({
    entityId: toObjectId(projectId, 'projectId'),
    $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
    deletedAt: null,
  }).lean();

  const updateProjectService = async (projectId, payload) => {
    const { name, code, description, status, pid, jiraProjectKey, jiraProductKey } = payload;
    const incomingJiraProjectKey = jiraProjectKey !== undefined ? jiraProjectKey : jiraProductKey;

    return updateVersionedDocument(Project, projectId, async (current) => {
      const nextName = name ? normalizeName(name) : current.name;
      const nextCode = code ? normalizeKey(code) : current.code;

      const duplicate = await Project.findOne({
        _id: { $ne: current._id },
        entityId: { $ne: current.entityId },
        $and: [
          activeLatestFilter(),
          { $or: [{ code: nextCode }, { name: nextName }] },
        ],
      }).lean();
      if (duplicate) {
        throw httpError(409, 'Project name or code already exists');
      }

      return {
        name: nextName,
        code: nextCode,
        description: description !== undefined ? description || '' : current.description,
        pid: pid !== undefined ? (pid ? String(pid).trim() : '') : current.pid,
        jiraProjectKey: incomingJiraProjectKey !== undefined
          ? (incomingJiraProjectKey ? String(incomingJiraProjectKey).trim() : '')
          : current.jiraProjectKey,
        status: status && ['active', 'archived'].includes(status) ? status : current.status,
        createdBy: current.createdBy,
      };
    });
  };

  const deleteProjectService = async (projectId) => {
    const project = await Project.findOne({ entityId: toObjectId(projectId, 'projectId') }).lean();
    if (!project) {
      throw httpError(404, 'Project not found');
    }

    const projectRefs = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectIdRefs = Array.from(
      new Set([...(projectRefs || []), project.entityId].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'projectId'));

    const [versionCount, groupCount, caseCount, planCount, runCount] = await Promise.all([
      Version.countDocuments({ project: { $in: projectIdRefs } }),
      TestCaseGroup.countDocuments({ project: { $in: projectIdRefs } }),
      TestCase.countDocuments({ project: { $in: projectIdRefs } }),
      TestPlan.countDocuments({ project: { $in: projectIdRefs } }),
      TestRun.countDocuments({ project: { $in: projectIdRefs } }),
    ]);

    if (versionCount || groupCount || caseCount || planCount || runCount) {
      throw httpError(409, 'Project has related records and cannot be deleted');
    }

    await softDeleteVersionSeries(Project, projectId);
  };

  const restoreProjectService = async (projectId) => {
    const project = await Project.findOne({ entityId: toObjectId(projectId, 'projectId') }).lean();
    if (!project) {
      throw httpError(404, 'Project not found');
    }

    const duplicate = await Project.findOne({
      entityId: { $ne: project.entityId },
      $and: [
        activeLatestFilter(),
        { $or: [{ code: project.code }, { name: project.name }] },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Another active project already uses the same name or code');
    }

    await restoreVersionSeries(Project, projectId);
    return Project.findOne({
      entityId: project.entityId,
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();
  };

  const createVersionService = async ({ projectId, name, releaseDate, notes, createdBy }) => {
    const project = await ensureProjectExists(projectId);
    const normalizedName = normalizeName(name);
    const projectRef = project.entityId || project._id;

    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectRefs = Array.from(
      new Set([...(projectVersionIds || []), project._id, project.entityId].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'projectId'));

    const existingVersion = await Version.findOne({
      project: { $in: projectRefs },
      deletedAt: null,
      isLatest: true,
      name: normalizedName,
    }).lean();
    if (existingVersion) {
      throw httpError(409, `Version "${name}" already exists in this project`);
    }

    const version = await Version.create({
      project: projectRef,
      projectVersionId: project._id,
      name: normalizedName,
      releaseDate,
      notes: notes || '',
      createdBy,
    });

    const populatedVersion = await Version.findById(version._id).lean();
    let projectObj = null;
    if (populatedVersion && populatedVersion.project) {
      projectObj = await Project.findOne({
        $and: [
          {
            $or: [
              { _id: populatedVersion.project },
              { entityId: populatedVersion.project },
            ],
          },
          { deletedAt: null },
          activeLatestFilter(),
        ],
      }).select('entityId name code deletedAt').lean();
    }

    return {
      ...populatedVersion,
      project: projectObj || (populatedVersion ? populatedVersion.project : null),
    };
  };

  const listVersionsService = async ({ projectId, search, includeDeleted }) => {
    const filters = [];

    if (projectId) {
      const project = await ensureProjectExists(projectId);
      const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
      const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
      filters.push({ project: { $in: projectIds.map((value) => toObjectId(value, 'projectId')) } });
    } else {
      const activeProjects = await Project.find({ deletedAt: null }).select('_id entityId').lean();
      const activeProjectIds = Array.from(
        new Set(activeProjects.flatMap((item) => [String(item._id), String(item.entityId || '')]).filter(Boolean)),
      );
      filters.push({ project: { $in: activeProjectIds.map((value) => toObjectId(value, 'projectId')) } });
    }

    if (includeDeleted !== 'true') {
      filters.push({ deletedAt: null });
      filters.push({ $or: [{ isLatest: true }, { isLatest: { $exists: false } }] });
    }

    if (search) {
      filters.push(buildSearchMatch(search, ['name', 'notes']));
    }

    const match = filters.length === 0 ? {} : filters.length === 1 ? filters[0] : { $and: filters };
    const versions = await Version.find(match)
      .sort({ createdAt: -1 })
      .lean();

    const referencedProjectIds = Array.from(new Set(versions.map((version) => String(version.project || '')).filter(Boolean)));
    const referencedProjects = referencedProjectIds.length > 0
      ? await Project.find({
          $or: [
            {
              _id: {
                $in: referencedProjectIds
                  .filter((value) => mongoose.Types.ObjectId.isValid(value))
                  .map((value) => toObjectId(value, 'projectId')),
              },
            },
            {
              entityId: {
                $in: referencedProjectIds
                  .filter((value) => mongoose.Types.ObjectId.isValid(value))
                  .map((value) => toObjectId(value, 'projectId')),
              },
            },
          ],
        }).select('entityId name code deletedAt').lean()
      : [];

    const projectMap = new Map();
    for (const project of referencedProjects) {
      projectMap.set(String(project._id), project);
      if (project.entityId) projectMap.set(String(project.entityId), project);
    }

    return versions.map((version) => ({
      ...version,
      project: projectMap.get(String(version.project)) || version.project || null,
    }));
  };

  const getVersionService = async (versionId) => {
    let version = await Version.findOne({
      entityId: toObjectId(versionId, 'versionId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    }).lean();

    if (!version && mongoose.Types.ObjectId.isValid(versionId)) {
      version = await Version.findOne({
        _id: toObjectId(versionId, 'versionId'),
        $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
        deletedAt: null,
      }).lean();
    }

    if (!version) {
      return null;
    }

    const project = await Project.findOne({
      $and: [
        {
          $or: [
            { _id: version.project },
            { entityId: version.project },
          ],
        },
        { deletedAt: null },
        activeLatestFilter(),
      ],
    }).select('entityId name code deletedAt').lean();

    return {
      ...version,
      project: project || version.project || null,
    };
  };

  const updateVersionService = async (versionId, payload) => {
    const { name, releaseDate, notes } = payload;
    const versionLookupId = toObjectId(versionId, 'versionId');
    const currentVersion = await Version.findOne({
      $and: [
        {
          $or: [
            { entityId: versionLookupId },
            { _id: versionLookupId },
          ],
        },
        activeLatestFilter(),
        { deletedAt: null },
      ],
    }).lean();
    if (!currentVersion) {
      throw httpError(404, 'Version not found');
    }

    const nextVersion = await updateVersionedDocument(
      Version,
      String(currentVersion.entityId || currentVersion._id),
      async (current) => {
        if (current.deletedAt) {
          throw httpError(409, 'Restore the version before editing it');
        }

        const latestProject = await resolveLatestProjectSnapshot(current.project, { includeDeleted: false });

        const nextName = name ? normalizeName(name) : current.name;
        const nextReleaseDate = releaseDate !== undefined ? (releaseDate || null) : current.releaseDate;
        const nextNotes = notes !== undefined ? notes || '' : current.notes;

        const project = await ensureProjectExists(current.project, { includeDeleted: false });
        const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
        const currentProjectRefs = Array.from(
          new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
        ).map((value) => toObjectId(value, 'projectId'));

        const duplicate = await Version.findOne({
          _id: { $ne: current._id },
          entityId: { $ne: current.entityId },
          project: { $in: currentProjectRefs },
          $and: [
            activeLatestFilter(),
            { name: nextName },
          ],
        }).lean();
        if (duplicate) {
          throw httpError(409, `Version "${nextName}" already exists in this project`);
        }

        return {
          project: current.project,
          projectVersionId: latestProject._id,
          name: nextName,
          releaseDate: nextReleaseDate,
          notes: nextNotes,
          createdBy: current.createdBy,
        };
      },
    );

    await repointVersionReferences(
      currentVersion.entityId || currentVersion._id,
      nextVersion,
    );

    const populated = await Version.findById(nextVersion._id).lean();
    const project = await Project.findOne({
      $and: [
        {
          $or: [
            { _id: populated.project },
            { entityId: populated.project },
          ],
        },
        { deletedAt: null },
        activeLatestFilter(),
      ],
    }).select('entityId name code deletedAt').lean();

    return {
      ...populated,
      project: project || populated.project || null,
    };
  };

  const deleteVersionService = async (versionId) => {
    const version = await Version.findOne({ entityId: toObjectId(versionId, 'versionId') });
    if (!version) {
      throw httpError(404, 'Version not found');
    }

    version.deletedAt = new Date();
    await version.save();
  };

  const restoreVersionService = async (versionId) => {
    const version = await Version.findOne({ entityId: toObjectId(versionId, 'versionId') });
    if (!version) {
      throw httpError(404, 'Version not found');
    }

    const duplicate = await Version.findOne({
      _id: { $ne: version._id },
      project: version.project,
      $and: [
        activeLatestFilter(),
        { name: version.name },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, `Version "${version.name}" already exists in this project`);
    }

    version.deletedAt = null;
    await version.save();
    return version;
  };

  return {
    createProjectService,
    listProjectsService,
    getProjectService,
    updateProjectService,
    deleteProjectService,
    restoreProjectService,
    createVersionService,
    listVersionsService,
    getVersionService,
    updateVersionService,
    deleteVersionService,
    restoreVersionService,
  };
};

module.exports = {
  buildProjectVersionServices,
};
