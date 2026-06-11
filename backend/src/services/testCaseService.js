const buildTestCaseServices = ({
  mongoose,
  XLSX,
  Project,
  TestCaseGroup,
  TestCase,
  TestPlan,
  TestRun,
  httpError,
  normalizeKey,
  normalizeName,
  buildSearchMatch,
  activeLatestFilter,
  toObjectId,
  extractReferenceId,
  objectIdString,
  createEntityId,
  buildVersionedList,
  getVersionHistory,
  ensureProjectExists,
  ensureGroupExists,
  buildTestCaseConflict,
  normalizeOverallExpected,
  normalizeStepExpected,
  normalizeManualSteps,
  normalizeAutomationSteps,
  updateVersionedDocument,
  softDeleteVersionSeries,
  restoreVersionSeries,
}) => {
  const defaultAutomation = () => ({
    enabled: false,
    runner: 'playwright',
    webId: '',
    baseUrl: '',
    userKey: '',
    timeoutMs: 30000,
    steps: [],
  });

  const normalizeAutomationConfig = (automation, fallback = null) => {
    if (automation) {
      return {
        enabled: Boolean(automation.enabled),
        runner: 'playwright',
        webId: String(automation.webId || '').trim(),
        baseUrl: String(automation.baseUrl || '').trim(),
        userKey: String(automation.userKey || '').trim(),
        timeoutMs: Number(automation.timeoutMs || 30000),
        steps: normalizeAutomationSteps(automation.steps),
      };
    }
    return fallback || defaultAutomation();
  };

  const createTestCaseService = async ({
    projectId,
    groupId,
    caseKey,
    key,
    title,
    name,
    description,
    expected,
    steps,
    automation,
    priority,
    severity,
    type,
    createdBy,
  }) => {
    const project = await ensureProjectExists(projectId);
    const group = await ensureGroupExists(groupId, project._id);
    const normalizedKey = normalizeKey(key || caseKey);
    const normalizedName = normalizeName(name || title);
    const normalizedAutomation = normalizeAutomationConfig(automation);

    if (normalizedAutomation.enabled && normalizedAutomation.steps.length === 0) {
      throw httpError(400, 'automation.steps[] are required when automation is enabled');
    }

    const groupRef = group.entityId || group._id;

    const duplicate = await TestCase.findOne({
      group: toObjectId(groupRef, 'groupId'),
      deletedAt: null,
      isLatest: true,
      key: normalizedKey,
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case key already exists in this group', {
        conflict: await buildTestCaseConflict(duplicate, groupRef),
      });
    }

    const testCase = await TestCase.create({
      entityId: createEntityId(),
      versionNumber: 1,
      isLatest: true,
      deletedAt: null,
      project: project.entityId ? project.entityId : project._id,
      projectVersionId: project._id,
      group: group.entityId ? group.entityId : group._id,
      groupVersionId: group._id,
      key: normalizedKey,
      name: normalizedName,
      caseKey: normalizedKey,
      title: normalizedName,
      description: description || '',
      expected: normalizeOverallExpected(expected),
      steps: normalizeManualSteps(steps),
      priority: priority || 'medium',
      severity: severity || 'major',
      type: type || 'functional',
      automation: normalizedAutomation,
      createdBy,
    });

    const createdDoc = await TestCase.findById(testCase._id).lean();

    let projectObj = null;
    if (createdDoc && createdDoc.project) {
      projectObj = await Project.findOne({
        $and: [
          { $or: [{ _id: createdDoc.project }, { entityId: createdDoc.project }] },
          activeLatestFilter(),
        ],
      }).select('entityId name code deletedAt').lean();
    }

    let groupObj = null;
    if (createdDoc && createdDoc.group) {
      groupObj = await TestCaseGroup.findOne({
        $and: [
          { $or: [{ _id: createdDoc.group }, { entityId: createdDoc.group }] },
          activeLatestFilter(),
        ],
      }).select('entityId name key deletedAt').lean();
    }

    const normalized = {
      ...createdDoc,
      project: projectObj || (createdDoc ? createdDoc.project : null),
      group: groupObj || (createdDoc ? createdDoc.group : null),
    };

    return normalized;
  };

  const listTestCasesService = async (query = {}) => {
    const { projectId, groupId, search, includeDeleted } = query;
    const baseFilters = {};

    if (projectId) {
      const project = await ensureProjectExists(projectId);
      try {
        const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
        const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
        baseFilters.project = { $in: projectIds.map((v) => toObjectId(v, 'projectId')) };
      } catch (err) {
        baseFilters.project = project._id;
      }
    } else {
      const activeProjectIds = await Project.find({ deletedAt: null }).distinct('_id');
      baseFilters.project = { $in: activeProjectIds };
    }

    if (groupId) {
      if (query.projectId) {
        const project = await ensureProjectExists(query.projectId);
        const resolvedGroup = await ensureGroupExists(groupId, project._id);
        const groupVersionIds = await TestCaseGroup.find({
          entityId: resolvedGroup.entityId || resolvedGroup._id,
        }).distinct('_id');
        const groupRefs = Array.from(
          new Set(
            [
              ...(groupVersionIds || []),
              resolvedGroup.entityId,
              resolvedGroup._id,
            ]
              .filter(Boolean)
              .map((value) => String(value)),
          ),
        ).map((value) => toObjectId(value, 'groupId'));
        baseFilters.group = { $in: groupRefs };
      } else {
        let resolvedGroup = await TestCaseGroup.findOne({
          entityId: toObjectId(groupId, 'groupId'),
          $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
          deletedAt: null,
        }).lean();
        if (!resolvedGroup) {
          resolvedGroup = await TestCaseGroup.findOne({ _id: toObjectId(groupId, 'groupId'), deletedAt: null }).lean();
        }
        if (!resolvedGroup) {
          throw httpError(404, 'Group not found');
        }
        const groupVersionIds = await TestCaseGroup.find({
          entityId: resolvedGroup.entityId || resolvedGroup._id,
        }).distinct('_id');
        const groupRefs = Array.from(
          new Set(
            [
              ...(groupVersionIds || []),
              resolvedGroup.entityId,
              resolvedGroup._id,
            ]
              .filter(Boolean)
              .map((value) => String(value)),
          ),
        ).map((value) => toObjectId(value, 'groupId'));
        baseFilters.group = { $in: groupRefs };
      }
    }

    const { docs: testCases, pagination } = await buildVersionedList({
      model: TestCase,
      query,
      search,
      searchFields: ['key', 'name', 'caseKey', 'title', 'description'],
      baseFilters,
      populate: [],
      includeDeleted: includeDeleted === 'true',
    });

    const referencedIds = Array.from(new Set(testCases.map((t) => extractReferenceId(t.project)).filter(Boolean)));
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

    const referencedGroupIds = Array.from(new Set(testCases.map((t) => extractReferenceId(t.group)).filter(Boolean)));
    let attachedGroups = [];
    if (referencedGroupIds.length > 0) {
      const referencedGroupObjectIds = referencedGroupIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
      attachedGroups = await TestCaseGroup.find({
        $or: [
          { _id: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
          { entityId: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
        ],
      }).select('entityId name key deletedAt').lean();
    }

    const groupMap = new Map();
    for (const group of attachedGroups) {
      groupMap.set(String(group._id), group);
      if (group.entityId) groupMap.set(String(group.entityId), group);
    }

    const normalizedTestCases = [];
    for (const t of testCases) {
      const refProjId = extractReferenceId(t.project);
      let proj = projectMap.get(refProjId) || t.project || null;
      if ((!proj || typeof proj !== 'object') && refProjId) {
        const found = await Project.findOne({
          $and: [
            { $or: [{ _id: refProjId }, { entityId: refProjId }] },
            activeLatestFilter(),
          ],
        }).select('entityId name code deletedAt').lean();
        if (found) proj = found;
      }

      const refGroupId = extractReferenceId(t.group);
      let grp = groupMap.get(refGroupId) || t.group || null;
      if ((!grp || typeof grp !== 'object') && refGroupId) {
        const foundG = await TestCaseGroup.findOne({
          $and: [
            { $or: [{ _id: refGroupId }, { entityId: refGroupId }] },
            activeLatestFilter(),
          ],
        }).select('entityId name key deletedAt').lean();
        if (foundG) grp = foundG;
      }

      normalizedTestCases.push({
        ...t,
        project: proj || null,
        group: grp || null,
      });
    }

    return { testCases: normalizedTestCases, pagination };
  };

  const listTestCaseDetailsService = async (query = {}) => {
    const { projectId, groupId, search } = query;
    if (!projectId) {
      return { testCases: [], pagination: null };
    }

    const project = await ensureProjectExists(projectId);
    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectIds = Array.from(new Set([...(projectVersionIds || []), String(project.entityId || project._id)]));
    const projectObjectIds = projectIds.map((v) => toObjectId(v, 'projectId'));

    const filters = [
      { project: { $in: projectObjectIds } },
      activeLatestFilter(),
    ];
    let resolvedGroup = null;
    if (groupId) {
      const groupObjectId = toObjectId(groupId, 'groupId');
      const groupVersionIds = await TestCaseGroup.find({
        $and: [
          { $or: [{ entityId: groupObjectId }, { _id: groupObjectId }] },
          { project: { $in: projectObjectIds } },
        ],
      }).distinct('_id');

      resolvedGroup = await TestCaseGroup.findOne({
        $and: [
          { $or: [{ entityId: groupObjectId }, { _id: groupObjectId }] },
          { project: { $in: projectObjectIds } },
          activeLatestFilter(),
        ],
      }).select('entityId name key deletedAt').lean();

      if (!resolvedGroup && groupVersionIds.length > 0) {
        resolvedGroup = await TestCaseGroup.findOne({
          _id: { $in: groupVersionIds.map((v) => toObjectId(v, 'groupId')) },
        }).select('entityId name key deletedAt').lean();
      }

      if (!groupVersionIds || groupVersionIds.length === 0) {
        return { testCases: [], pagination: null };
      }

      const groupRefs = Array.from(
        new Set(
          [
            ...groupVersionIds.map((value) => String(value)),
            String(groupObjectId),
            resolvedGroup?.entityId ? String(resolvedGroup.entityId) : '',
          ].filter(Boolean),
        ),
      );
      const groupRefObjectIds = groupRefs
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
        .map((value) => toObjectId(value, 'groupId'));

      if (groupRefObjectIds.length === 0) {
        return { testCases: [], pagination: null };
      }

      filters.push({ group: { $in: groupRefObjectIds } });
    }

    if (search) {
      filters.push(buildSearchMatch(search, ['key', 'name', 'caseKey', 'title', 'description']));
    }

    const match = filters.length === 1 ? filters[0] : { $and: filters };

    const testCases = await TestCase.find(match)
      .sort({ createdAt: -1 })
      .populate('group', 'entityId name key deletedAt')
      .lean();

    if (testCases.length === 0) {
      return { testCases: [] };
    }

    const entityIds = testCases
      .map((testCase) => testCase.entityId)
      .filter(Boolean);

    const allCaseVersions = await TestCase.find({
      project: { $in: projectObjectIds },
      entityId: { $in: entityIds },
    })
      .select('_id entityId')
      .lean();

    const versionIdToEntityId = new Map(
      allCaseVersions.map((row) => [objectIdString(row._id), objectIdString(row.entityId)]),
    );
    const knownEntityIds = new Set(
      allCaseVersions.map((row) => objectIdString(row.entityId)).filter(Boolean),
    );

    const resolveHistoryEntityId = (testCaseRef) => {
      if (!testCaseRef) {
        return '';
      }
      if (versionIdToEntityId.has(testCaseRef)) {
        return versionIdToEntityId.get(testCaseRef);
      }
      if (knownEntityIds.has(testCaseRef)) {
        return testCaseRef;
      }
      return '';
    };

    const sortExecutionHistory = (entries) => entries.slice().sort((left, right) => {
      const leftTime = new Date(left.executedAt || left.startedAt || 0).getTime();
      const rightTime = new Date(right.executedAt || right.startedAt || 0).getTime();
      return rightTime - leftTime;
    });

    let historyByEntity = new Map();
    if (allCaseVersions.length > 0) {
      const historyRuns = await TestRun.find({
        project: { $in: projectObjectIds },
      })
        .select('name status startedAt endedAt startedBy endedBy results')
        .populate('startedBy', 'name email role')
        .populate('endedBy', 'name email role')
        .lean();

      const referencedGroupIds = Array.from(new Set(
        historyRuns.flatMap((run) => (run.results || []).map((result) => objectIdString(result.group)).filter(Boolean)),
      ));
      const referencedGroupObjectIds = referencedGroupIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
      const referencedGroups = referencedGroupObjectIds.length > 0
        ? await TestCaseGroup.find({
          $or: [
            { _id: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
            { entityId: { $in: referencedGroupObjectIds.map((v) => toObjectId(v, 'groupId')) } },
          ],
        }).select('entityId name key deletedAt').lean()
        : [];

      const groupMap = new Map();
      for (const group of referencedGroups) {
        groupMap.set(String(group._id), group);
        if (group.entityId) groupMap.set(String(group.entityId), group);
      }

      historyByEntity = historyRuns.reduce((acc, run) => {
        const runStartedAt = run.startedAt || run.createdAt || null;

        (run.results || [])
          .filter((result) => ['pass', 'fail', 'blocked', 'skip'].includes(result.status) && result.testCase)
          .forEach((result) => {
            const entityId = resolveHistoryEntityId(objectIdString(result.testCase));
            if (!entityId) {
              return;
            }

            const resultGroup = result.group ? (groupMap.get(objectIdString(result.group)) || null) : null;
            const existing = acc.get(entityId) || [];
            existing.push({
              runId: String(run._id),
              runName: run.name,
              runStatus: run.status,
              status: result.status,
              executedAt: result.executedAt || runStartedAt,
              startedAt: run.startedAt || run.createdAt || null,
              endedAt: run.endedAt || null,
              startedBy: run.startedBy || null,
              endedBy: run.endedBy || null,
              group: resultGroup,
              note: result.note || result.notes || '',
            });
            acc.set(entityId, existing);
          });

        return acc;
      }, new Map());
    }

    const detailRows = testCases.map((testCase) => {
      const executionHistory = sortExecutionHistory(
        historyByEntity.get(objectIdString(testCase.entityId)) || [],
      );

      return {
        ...testCase,
        group: executionHistory[0]?.group || resolvedGroup || testCase.group || null,
        recentStatuses: executionHistory.slice(0, 3).map((entry) => entry.status),
        executionHistory,
      };
    });

    return { testCases: detailRows };
  };

  const getTestCaseService = async (testCaseId) => {
    const testCase = await TestCase.findOne({
      entityId: toObjectId(testCaseId, 'testCaseId'),
      $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
      deletedAt: null,
    })
      .populate('project', 'entityId name code deletedAt')
      .populate('group', 'name key deletedAt')
      .lean();
    if (!testCase) {
      return null;
    }

    return testCase;
  };

  const getTestCaseVersionsService = async (testCaseId) => {
    return getVersionHistory(TestCase, testCaseId);
  };

  const updateTestCaseService = async (testCaseId, payload = {}) => {
    const {
      projectId,
      groupId,
      caseKey,
      key,
      title,
      name,
      description,
      expected,
      steps,
      automation,
      priority,
      severity,
      type,
      status,
    } = payload;

    const currentCaseId = toObjectId(testCaseId, 'testCaseId');
    const currentCase = await TestCase.findOne({
      $or: [
        { entityId: currentCaseId },
        { _id: currentCaseId },
      ],
    }).lean();
    if (!currentCase) {
      throw httpError(404, 'Test case not found');
    }

    const currentCaseRefs = [currentCase.entityId || currentCase._id, currentCase._id].filter(Boolean);

    const updated = await updateVersionedDocument(TestCase, testCaseId, async (current) => {
      const requestedProjectRef = projectId ? toObjectId(projectId, 'projectId') : current.project;
      const requestedGroupRef = groupId ? toObjectId(groupId, 'groupId') : current.group;

      const resolvedProject = await ensureProjectExists(requestedProjectRef, { includeDeleted: false });
      const resolvedGroup = await ensureGroupExists(requestedGroupRef, resolvedProject._id, { includeDeleted: false });

      const storeProjectRef = resolvedProject.entityId ? resolvedProject.entityId : resolvedProject._id;
      const storeGroupRef = resolvedGroup.entityId ? resolvedGroup.entityId : resolvedGroup._id;
      const groupRef = resolvedGroup.entityId || resolvedGroup._id;

      const normalizedKey = normalizeKey(key || caseKey || current.key || current.caseKey);
      const normalizedName = normalizeName(name || title || current.name || current.title);

      const duplicate = await TestCase.findOne({
        _id: { $ne: current._id },
        group: toObjectId(groupRef, 'groupId'),
        deletedAt: null,
        isLatest: true,
        key: normalizedKey,
      }).lean();
      if (duplicate) {
        throw httpError(409, 'Test case key already exists in this group', {
          conflict: await buildTestCaseConflict(duplicate, groupRef),
        });
      }

      const nextExpected = expected !== undefined
        ? normalizeOverallExpected(expected)
        : normalizeOverallExpected(current.expected);

      const nextSteps = Array.isArray(steps)
        ? normalizeManualSteps(steps)
        : current.steps;

      const nextAutomation = normalizeAutomationConfig(automation, current.automation);

      if (nextAutomation.enabled && nextAutomation.steps.length === 0) {
        throw httpError(400, 'automation.steps[] are required when automation is enabled');
      }

      return {
        project: storeProjectRef,
        projectVersionId: resolvedProject._id,
        group: storeGroupRef,
        groupVersionId: resolvedGroup._id,
        key: normalizedKey,
        name: normalizedName,
        caseKey: normalizedKey,
        title: normalizedName,
        description: description !== undefined ? description || '' : current.description,
        expected: nextExpected,
        steps: nextSteps,
        priority: priority || current.priority,
        severity: severity || current.severity,
        type: type || current.type,
        status: status && ['active', 'deprecated'].includes(status) ? status : current.status,
        automation: nextAutomation,
        createdBy: current.createdBy,
      };
    });

    await TestPlan.updateMany(
      {
        deletedAt: null,
        $or: [{ isLatest: true }, { isLatest: { $exists: false } }],
        'items.testCase': { $in: currentCaseRefs },
      },
      {
        $set: {
          'items.$[item].testCase': updated.entityId || updated._id,
          'items.$[item].testCaseVersionId': updated._id,
        },
      },
      {
        arrayFilters: [
          {
            'item.testCase': { $in: currentCaseRefs },
          },
        ],
      },
    );

    const updatedDoc = await TestCase.findById(updated._id).lean();

    let projectObj = null;
    if (updatedDoc && updatedDoc.project) {
      projectObj = await Project.findOne({
        $and: [
          { $or: [{ _id: updatedDoc.project }, { entityId: updatedDoc.project }] },
          activeLatestFilter(),
        ],
      }).select('entityId name code deletedAt').lean();
    }

    let groupObj = null;
    if (updatedDoc && updatedDoc.group) {
      groupObj = await TestCaseGroup.findOne({
        $and: [
          { $or: [{ _id: updatedDoc.group }, { entityId: updatedDoc.group }] },
          activeLatestFilter(),
        ],
      }).select('entityId name key deletedAt').lean();
    }

    const normalized = {
      ...updatedDoc,
      project: projectObj || (updatedDoc ? updatedDoc.project : null),
      group: groupObj || (updatedDoc ? updatedDoc.group : null),
    };

    return normalized;
  };

  const importTestCasesService = async ({ file, body = {}, userId }) => {
    if (!file) {
      throw httpError(400, 'File is required');
    }

    const { projectId } = body;

    const project = await ensureProjectExists(projectId);
    const projectRefs = [String(project._id), String(project.entityId || '')].filter(Boolean);

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      if (!Array.isArray(rows) || rows.length === 0) {
        throw httpError(400, 'Excel sheet is empty or invalid');
      }

      const created = [];
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const rowGroupKey = String(row['Group Key'] || '').trim();
          const rowGroupName = String(row['Group Name'] || row.Group || '').trim();
          const caseKey = String(row['Case Key'] || '').trim();
          const title = String(row.Title || '').trim();
          const description = String(row.Description || '').trim();
          const priority = String(row.Priority || 'medium').trim().toLowerCase();
          const severity = String(row.Severity || 'major').trim().toLowerCase();
          const type = String(row.Type || 'functional').trim().toLowerCase();

          if (!rowGroupKey && !rowGroupName) {
            errors.push({
              row: i + 2,
              error: 'Group Key or Group Name is required',
            });
            continue;
          }

          if (!caseKey || !title) {
            errors.push({
              row: i + 2,
              error: 'Case Key and Title are required',
            });
            continue;
          }

          const groupQuery = {
            project: { $in: projectRefs.map((value) => toObjectId(value, 'projectId')) },
            deletedAt: null,
            isLatest: true,
          };

          if (rowGroupKey) {
            groupQuery.key = normalizeKey(rowGroupKey);
          } else {
            groupQuery.name = normalizeName(rowGroupName);
          }

          const group = await TestCaseGroup.findOne(groupQuery).lean();
          if (!group) {
            errors.push({
              row: i + 2,
              error: `Test case group '${rowGroupKey || rowGroupName}' not found in selected project`,
            });
            continue;
          }

          const expectedResult = String(row['Expected Result'] || '').trim();
          if (!expectedResult) {
            errors.push({
              row: i + 2,
              error: 'Expected Result is required',
            });
            continue;
          }

          const stepPattern = /^Step\s*(\d+)\s*Action$/i;
          const detectedSteps = Object.keys(row)
            .map((colKey) => {
              const m = String(colKey).match(stepPattern);
              if (!m) return null;
              const idx = parseInt(m[1], 10);
              return { key: colKey, idx };
            })
            .filter(Boolean)
            .sort((a, b) => a.idx - b.idx);

          const stepExpectedPattern = /^Step\s*(\d+)\s*Expected$/i;
          const stepExpectedByIndex = Object.keys(row).reduce((acc, colKey) => {
            const match = String(colKey).match(stepExpectedPattern);
            if (!match) {
              return acc;
            }

            const idx = parseInt(match[1], 10);
            acc[idx] = normalizeStepExpected(row[colKey]);
            return acc;
          }, {});

          const steps = [];
          for (const s of detectedSteps) {
            const action = String(row[s.key] || '').trim();
            if (action) {
              steps.push({
                order: s.idx,
                action,
                expected: stepExpectedByIndex[s.idx] ?? null,
              });
            }
          }

          if (steps.length === 0) {
            errors.push({ row: i + 2, error: 'At least one step action is required' });
            continue;
          }

          const normalizedCaseKey = normalizeKey(caseKey);
          const normalizedCaseName = normalizeName(title);

          const groupRef = group.entityId || group._id;

          const duplicate = await TestCase.findOne({
            group: toObjectId(groupRef, 'groupId'),
            deletedAt: null,
            isLatest: true,
            key: normalizedCaseKey,
          }).lean();
          if (duplicate) {
            errors.push({
              row: i + 2,
              error: `Test case '${normalizedCaseKey}' already exists in group '${group.name}'`,
              conflict: await buildTestCaseConflict(duplicate, groupRef),
            });
            continue;
          }

          const strict = String(body.strict || '').toLowerCase() === 'true';
          if (strict) {
            if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
              errors.push({ row: i + 2, error: `Invalid priority '${priority}'` });
              continue;
            }
            if (!['minor', 'major', 'critical'].includes(severity)) {
              errors.push({ row: i + 2, error: `Invalid severity '${severity}'` });
              continue;
            }
            if (!['functional', 'api', 'ui', 'regression', 'security', 'other'].includes(type)) {
              errors.push({ row: i + 2, error: `Invalid type '${type}'` });
              continue;
            }
          }

          const testCase = await TestCase.create({
            entityId: createEntityId(),
            versionNumber: 1,
            isLatest: true,
            deletedAt: null,
            project: project.entityId ? project.entityId : project._id,
            projectVersionId: project._id,
            group: group.entityId ? group.entityId : group._id,
            groupVersionId: group._id,
            key: normalizedCaseKey,
            name: normalizedCaseName,
            caseKey: normalizedCaseKey,
            title: normalizedCaseName,
            description,
            expected: expectedResult,
            steps,
            priority: ['low', 'medium', 'high', 'critical'].includes(priority)
              ? priority
              : 'medium',
            severity: ['minor', 'major', 'critical'].includes(severity)
              ? severity
              : 'major',
            type: ['functional', 'api', 'ui', 'regression', 'security', 'other'].includes(type)
              ? type
              : 'functional',
            status: 'active',
            createdBy: userId,
          });

          created.push({
            _id: testCase._id,
            caseKey: testCase.caseKey,
            title: testCase.title,
          });
        } catch (rowErr) {
          errors.push({
            row: i + 2,
            error: String(rowErr?.message || 'Unknown error'),
          });
        }
      }

      return {
        message: `Imported ${created.length} test cases`,
        created,
        errors,
        total: rows.length,
      };
    } catch (err) {
      throw httpError(400, `Excel parsing error: ${err.message}`);
    }
  };

  const deleteTestCaseService = async (testCaseId) => {
    await softDeleteVersionSeries(TestCase, testCaseId);
  };

  const restoreTestCaseService = async (testCaseId) => {
    const current = await TestCase.findOne({ entityId: toObjectId(testCaseId, 'testCaseId') }).lean();
    if (!current) {
      throw httpError(404, 'Test case not found');
    }

    const project = await ensureProjectExists(current.project, { includeDeleted: true });
    const group = await TestCaseGroup.findOne({
      $or: [
        { entityId: current.group },
        { _id: current.group },
      ],
    }).lean();
    if (!group) {
      throw httpError(404, 'Test case group not found');
    }

    const projectVersionIds = await Project.find({ entityId: project.entityId }).distinct('_id');
    const projectRefs = Array.from(
      new Set([...(projectVersionIds || []), project.entityId, project._id].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'projectId'));

    const groupVersionIds = await TestCaseGroup.find({ entityId: group.entityId }).distinct('_id');
    const groupRefs = Array.from(
      new Set([...(groupVersionIds || []), group.entityId, group._id].filter(Boolean).map((value) => String(value))),
    ).map((value) => toObjectId(value, 'groupId'));

    const duplicate = await TestCase.findOne({
      _id: { $ne: current._id },
      project: { $in: projectRefs },
      group: { $in: groupRefs },
      $and: [
        activeLatestFilter(),
        { key: current.key },
      ],
    }).lean();
    if (duplicate) {
      throw httpError(409, 'Test case key already exists in this group');
    }

    await restoreVersionSeries(TestCase, testCaseId);
    const testCase = await TestCase.findOne({ entityId: toObjectId(testCaseId, 'testCaseId') })
      .populate('project', 'entityId name code deletedAt')
      .populate('group', 'name key deletedAt')
      .lean();
    return testCase;
  };

  return {
    createTestCaseService,
    listTestCasesService,
    listTestCaseDetailsService,
    importTestCasesService,
    getTestCaseService,
    getTestCaseVersionsService,
    updateTestCaseService,
    deleteTestCaseService,
    restoreTestCaseService,
  };
};

module.exports = {
  buildTestCaseServices,
};
