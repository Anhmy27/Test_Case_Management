"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, getId } from "@/lib/api";
import {
  buildJiraBugDescription,
  findProjectByReference,
  getProjectJiraProjectKey,
  getRunDocumentId,
  mapPriorityToJira,
  type JiraBugDialogState,
} from "@/components/jira/jiraBugUtils";

type RecordAny = Record<string, any>;
type JiraVersionSuggestion = { id: string; name: string; description?: string };

function getAssigneeValue(assignee: RecordAny) {
  return String(assignee.name || assignee.key || assignee.accountId || "");
}

function getIssueTypeOptionValue(issueType: RecordAny) {
  return String(issueType.idjira || getId(issueType) || "").trim();
}

function getValidIssueTypes(issueTypeList: RecordAny[]) {
  return issueTypeList.filter((issueType) => {
    const value = getIssueTypeOptionValue(issueType);
    const name = String(issueType.name || "").trim();
    return Boolean(value && name);
  });
}

function parseLabelTokens(value: string) {
  return value
    .split(/[,;]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function joinLabelTokens(tokens: string[]) {
  return tokens.join(", ");
}

function addLabelToken(current: string, label: string) {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) {
    return current;
  }

  const tokens = parseLabelTokens(current);
  if (tokens.includes(normalizedLabel)) {
    return current;
  }

  return joinLabelTokens([...tokens, normalizedLabel]);
}

function removeLabelToken(current: string, label: string) {
  return joinLabelTokens(parseLabelTokens(current).filter((token) => token !== label));
}

type Options = {
  onNotice?: (message: string) => void;
};

export function useJiraBugDialog({ onNotice }: Options) {
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [issueTypes, setIssueTypes] = useState<RecordAny[]>([]);
  const [referenceDataLoaded, setReferenceDataLoaded] = useState(false);

  const [jiraBugDialog, setJiraBugDialog] = useState<JiraBugDialogState | null>(null);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assigneeOptions, setAssigneeOptions] = useState<RecordAny[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [labelQuery, setLabelQuery] = useState("");
  const [labelSuggestions, setLabelSuggestions] = useState<string[]>([]);
  const [labelLoading, setLabelLoading] = useState(false);
  const [versionQuery, setVersionQuery] = useState("");
  const [versionSuggestions, setVersionSuggestions] = useState<JiraVersionSuggestion[]>([]);
  const [versionLoading, setVersionLoading] = useState(false);

  const ensureReferenceData = useCallback(async () => {
    if (referenceDataLoaded) {
      return { projects, issueTypes };
    }

    const [projectsResponse, issueTypesResponse] = await Promise.all([
      apiRequest<{ projects: RecordAny[] }>("/api/projects"),
      apiRequest<{ issueTypes: RecordAny[] }>("/api/issue-types"),
    ]);

    const nextProjects = Array.isArray(projectsResponse.projects) ? projectsResponse.projects : [];
    const nextIssueTypes = Array.isArray(issueTypesResponse.issueTypes) ? issueTypesResponse.issueTypes : [];

    setProjects(nextProjects);
    setIssueTypes(nextIssueTypes);
    setReferenceDataLoaded(true);

    return {
      projects: nextProjects,
      issueTypes: nextIssueTypes,
    };
  }, [issueTypes, projects, referenceDataLoaded]);

  const closeJiraBugDialog = useCallback(() => {
    setJiraBugDialog(null);
    setAssigneeQuery("");
    setAssigneeOptions([]);
    setAssigneeDropdownOpen(false);
    setAssigneeLoading(false);
    setLabelQuery("");
    setLabelSuggestions([]);
    setLabelLoading(false);
    setVersionQuery("");
    setVersionSuggestions([]);
    setVersionLoading(false);
  }, []);

  const updateJiraBugDialog = useCallback((patch: Partial<JiraBugDialogState>) => {
    setJiraBugDialog((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const openJiraBugDialog = useCallback(
    async (run: RecordAny, result: RecordAny) => {
      let referenceData: { projects: RecordAny[]; issueTypes: RecordAny[] };
      try {
        referenceData = await ensureReferenceData();
      } catch (error) {
        onNotice?.(error instanceof Error ? error.message : "Unable to load Jira reference data");
        return;
      }

      const project =
        findProjectByReference(referenceData.projects, run?.project) ||
        findProjectByReference(referenceData.projects, run?.project?._id);
      const projectId = String(getId(project) || getId(run?.project) || run?.project || "").trim();

      if (!project || !projectId) {
        onNotice?.("Run project is missing or not found");
        return;
      }

      if (!project.pid) {
        onNotice?.("Project is missing Jira pid. Update the project before logging a bug.");
        return;
      }

      if (!getProjectJiraProjectKey(project)) {
        onNotice?.("Project is missing Jira project key");
        return;
      }

      const validIssueTypes = getValidIssueTypes(referenceData.issueTypes);
      const defaultIssueType =
        validIssueTypes.length > 0 ? getIssueTypeOptionValue(validIssueTypes[0]) : "";

      setJiraBugDialog({
        projectId,
        projectName: project.name || "",
        runId: getRunDocumentId(run) || "",
        resultId: getId(result) || "",
        caseKey: result?.testCase?.caseKey || "TC",
        caseTitle: result?.testCase?.title || "Untitled",
        issueType: defaultIssueType,
        summary: `[${result?.testCase?.caseKey || "TC"}] ${result?.testCase?.title || "Untitled"}`,
        description: buildJiraBugDescription(run, result),
        priority: mapPriorityToJira(result?.testCase?.priority),
        assignee: "",
        originalEstimate: "",
        versions: [],
        labels: "",
        submitting: false,
        error: "",
      });
      setAssigneeQuery("");
      setAssigneeOptions([]);
      setAssigneeDropdownOpen(false);
      setLabelQuery("");
      setLabelSuggestions([]);
      setVersionQuery("");
      setVersionSuggestions([]);
    },
    [ensureReferenceData, onNotice],
  );

  const submitJiraBug = useCallback(async () => {
    if (!jiraBugDialog) {
      return;
    }

    updateJiraBugDialog({ submitting: true, error: "" });

    try {
      const response = await apiRequest<{ issueKey?: string; message?: string }>("/api/jira/log-bug", undefined, {
        method: "POST",
        body: JSON.stringify({
          projectId: jiraBugDialog.projectId,
          summary: jiraBugDialog.summary,
          description: jiraBugDialog.description,
          issueType: jiraBugDialog.issueType,
          priority: jiraBugDialog.priority,
          assignee: jiraBugDialog.assignee,
          timetracking_originalestimate: jiraBugDialog.originalEstimate,
          versions: jiraBugDialog.versions,
          labels: jiraBugDialog.labels,
        }),
      });

      onNotice?.(
        response.issueKey
          ? `Jira bug created: ${response.issueKey}`
          : response.message || "Jira bug created",
      );
      closeJiraBugDialog();
    } catch (error) {
      updateJiraBugDialog({
        submitting: false,
        error: error instanceof Error ? error.message : "Unable to log Jira bug",
      });
    }
  }, [closeJiraBugDialog, jiraBugDialog, onNotice, updateJiraBugDialog]);

  const selectedAssigneeDetail = jiraBugDialog?.assignee
    ? assigneeOptions.find((assignee) => getAssigneeValue(assignee) === jiraBugDialog.assignee) || null
    : null;
  const selectedAssigneeLabel = String(
    selectedAssigneeDetail?.displayName ||
      selectedAssigneeDetail?.name ||
      selectedAssigneeDetail?.key ||
      jiraBugDialog?.assignee ||
      "",
  );

  const validIssueTypes = useMemo(() => getValidIssueTypes(issueTypes), [issueTypes]);
  const selectedLabels = useMemo(
    () => (jiraBugDialog ? parseLabelTokens(jiraBugDialog.labels) : []),
    [jiraBugDialog],
  );
  const selectedVersions = jiraBugDialog?.versions || [];
  const selectedVersionNames = selectedVersions.map((versionId) => {
    const matched = versionSuggestions.find((item) => item.id === versionId);
    return {
      id: versionId,
      name: matched?.name || versionId,
      description: matched?.description || "",
    };
  });

  useEffect(() => {
    if (!jiraBugDialog) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setLabelLoading(true);

      void apiRequest<{ suggestions?: Array<{ label?: string }> }>(
        `/api/jira/label-suggestions?query=${encodeURIComponent(labelQuery)}`,
      )
        .then((response) => {
          if (cancelled) {
            return;
          }

          const suggestions = Array.isArray(response.suggestions) ? response.suggestions : [];
          const labels = suggestions
            .map((item) => String(item.label || "").trim())
            .filter(Boolean);
          setLabelSuggestions(labels);
        })
        .catch(() => {
          if (!cancelled) {
            setLabelSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLabelLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [jiraBugDialog, labelQuery]);

  useEffect(() => {
    if (!jiraBugDialog?.projectId) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setVersionLoading(true);

      const url =
        `/api/jira/version-suggestions?projectId=${encodeURIComponent(jiraBugDialog.projectId)}` +
        `&maxResults=100&startAt=0&query=${encodeURIComponent(versionQuery)}`;

      void apiRequest<{ suggestions?: Array<{ id?: string; name?: string; description?: string }> }>(url)
        .then((response) => {
          if (cancelled) {
            return;
          }

          const suggestions = Array.isArray(response.suggestions) ? response.suggestions : [];
          setVersionSuggestions(
            suggestions
              .map((item) => ({
                id: String(item.id || "").trim(),
                name: String(item.name || "").trim(),
                description: String(item.description || "").trim(),
              }))
              .filter((item) => item.id && item.name),
          );
        })
        .catch(() => {
          if (!cancelled) {
            setVersionSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setVersionLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [jiraBugDialog?.projectId, versionQuery]);

  useEffect(() => {
    if (!jiraBugDialog?.projectId || !assigneeDropdownOpen) {
      return;
    }

    const project = findProjectByReference(projects, jiraBugDialog.projectId);
    const projectKey = getProjectJiraProjectKey(project);

    if (!projectKey) {
      return;
    }

    const url = `/api/jira/assignable-users?projectKeys=${encodeURIComponent(projectKey)}&maxResults=100&username=${encodeURIComponent(assigneeQuery || "")}`;

    let cancelled = false;

    void apiRequest<{ users: RecordAny[] }>(url)
      .then((response) => {
        if (!cancelled) {
          setAssigneeOptions(Array.isArray(response.users) ? response.users : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssigneeOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAssigneeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assigneeDropdownOpen, assigneeQuery, jiraBugDialog?.projectId, projects]);

  const dialogNode = jiraBugDialog ? (
    <div className="tcm-confirm-overlay" role="presentation">
      <div className="jira-bug-modal" role="dialog" aria-modal="true" aria-labelledby="jira-bug-title">
        <div className="jira-bug-modal__header">
          <div className="jira-bug-modal__titleblock">
            <h3 id="jira-bug-title">Log Bug</h3>
            <p>Review the Jira payload, adjust the editable fields, then submit the issue.</p>
          </div>
          <button type="button" className="tcm-toast__close" onClick={closeJiraBugDialog} aria-label="Close dialog">
            ×
          </button>
        </div>

        {jiraBugDialog.error ? <div className="jira-bug-modal__alert">{jiraBugDialog.error}</div> : null}

        <div className="jira-bug-modal__summary">
          <div>
            <span>Project</span>
            <strong>{jiraBugDialog.projectName || "-"}</strong>
          </div>
          <div>
            <span>Run</span>
            <strong>{jiraBugDialog.runId || "-"}</strong>
          </div>
          <div>
            <span>Case</span>
            <strong>
              {jiraBugDialog.caseKey} - {jiraBugDialog.caseTitle}
            </strong>
          </div>
        </div>

        <div className="jira-bug-modal__body">
          <section className="jira-bug-modal__section">
            <div className="jira-bug-modal__section-head">
              <div>
                <span>Jira mapping</span>
                <h4>Project and issue metadata</h4>
              </div>
              <p>These fields control where the bug is created.</p>
            </div>
            <div className="workspace-form jira-bug-modal__form">
              <div className="workspace-form__grid workspace-form__grid--two">
                <label>
                  <span>Issue type</span>
                  <select
                    value={jiraBugDialog.issueType}
                    onChange={(event) => updateJiraBugDialog({ issueType: event.target.value })}
                    disabled={validIssueTypes.length === 0}
                  >
                    {validIssueTypes.map((issueType) => {
                      const optionValue = getIssueTypeOptionValue(issueType);
                      return (
                        <option key={getId(issueType)} value={optionValue}>
                          {issueType.name}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={jiraBugDialog.priority}
                    onChange={(event) => updateJiraBugDialog({ priority: event.target.value })}
                  >
                    <option value="1">1 - Highest</option>
                    <option value="2">2 - High</option>
                    <option value="3">3 - Medium</option>
                    <option value="4">4 - Low</option>
                    <option value="5">5 - Lowest</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="jira-bug-modal__section jira-bug-modal__section--wide">
            <div className="jira-bug-modal__section-head">
              <div>
                <span>Bug content</span>
                <h4>Text that will be sent to Jira</h4>
              </div>
              <p>Keep summary short and description detailed.</p>
            </div>
            <div className="workspace-form jira-bug-modal__form">
              <label>
                <span>Summary</span>
                <input
                  value={jiraBugDialog.summary}
                  onChange={(event) => updateJiraBugDialog({ summary: event.target.value })}
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  rows={9}
                  value={jiraBugDialog.description}
                  onChange={(event) => updateJiraBugDialog({ description: event.target.value })}
                />
              </label>
              <label>
                <span>Labels</span>
                <input
                  type="search"
                  value={labelQuery}
                  onChange={(event) => setLabelQuery(event.target.value)}
                  placeholder="Tim label trong Jira..."
                />
              </label>
              {selectedLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedLabels.map((label) => (
                    <span key={label} className="workspace-pill bg-slate-100 text-slate-700">
                      {label}
                      <button
                        type="button"
                        className="ml-2 text-slate-500 hover:text-slate-800"
                        onClick={() =>
                          updateJiraBugDialog({
                            labels: removeLabelToken(jiraBugDialog.labels, label),
                          })
                        }
                        aria-label={`Remove label ${label}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <label>
                <span>Chon label</span>
                <select
                  value=""
                  disabled={labelLoading || labelSuggestions.length === 0}
                  onChange={(event) => {
                    const pickedLabel = event.target.value;
                    if (!pickedLabel) {
                      return;
                    }

                    updateJiraBugDialog({
                      labels: addLabelToken(jiraBugDialog.labels, pickedLabel),
                    });
                  }}
                >
                  <option value="">
                    {labelLoading
                      ? "Dang tai label..."
                      : labelSuggestions.length === 0
                        ? "Khong co label phu hop"
                        : "Chon label"}
                  </option>
                  {labelSuggestions.map((label) => (
                    <option key={label} value={label} disabled={selectedLabels.includes(label)}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="workspace-note">Labels duoc lay tu Jira suggest API theo query ban nhap.</div>
              <label>
                <span>Affects Versions</span>
                <input
                  type="search"
                  value={versionQuery}
                  onChange={(event) => setVersionQuery(event.target.value)}
                  placeholder="Tim version trong Jira..."
                />
              </label>
              {selectedVersionNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedVersionNames.map((version) => (
                    <span key={version.id} className="workspace-pill bg-slate-100 text-slate-700">
                      {version.name}
                      <button
                        type="button"
                        className="ml-2 text-slate-500 hover:text-slate-800"
                        onClick={() =>
                          updateJiraBugDialog({
                            versions: selectedVersions.filter((item) => item !== version.id),
                          })
                        }
                        aria-label={`Remove version ${version.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <label>
                <span>Chon Affects Version</span>
                <select
                  value=""
                  disabled={versionLoading || versionSuggestions.length === 0}
                  onChange={(event) => {
                    const pickedVersionId = event.target.value;
                    if (!pickedVersionId || selectedVersions.includes(pickedVersionId)) {
                      return;
                    }

                    updateJiraBugDialog({
                      versions: [...selectedVersions, pickedVersionId],
                    });
                  }}
                >
                  <option value="">
                    {versionLoading
                      ? "Dang tai version..."
                      : versionSuggestions.length === 0
                        ? "Khong co version phu hop"
                        : "Chon Affects Version"}
                  </option>
                  {versionSuggestions.map((version) => (
                    <option key={version.id} value={version.id} disabled={selectedVersions.includes(version.id)}>
                      {version.description ? `${version.name} - ${version.description}` : version.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="workspace-note">
                Affects Versions duoc lay tu Jira API theo project va query.
              </div>
              <label>
                <span>Original Estimate</span>
                <input
                  value={jiraBugDialog.originalEstimate}
                  onChange={(event) => updateJiraBugDialog({ originalEstimate: event.target.value })}
                  placeholder="eg. 3w 4d 12h"
                />
              </label>
            </div>
          </section>

          <section className="jira-bug-modal__section">
            <div className="jira-bug-modal__section-head">
              <div>
                <span>Assignee</span>
                <h4>Search Jira users</h4>
              </div>
            </div>
            <div className="workspace-form jira-bug-modal__form">
              <label>
                <span>Search assignee</span>
                <input
                  value={assigneeQuery || selectedAssigneeLabel}
                  onChange={(event) => {
                    if (jiraBugDialog.assignee && !assigneeQuery && event.target.value !== selectedAssigneeLabel) {
                      updateJiraBugDialog({ assignee: "" });
                    }
                    setAssigneeQuery(event.target.value);
                    setAssigneeDropdownOpen(true);
                    setAssigneeLoading(true);
                  }}
                  onFocus={() => {
                    setAssigneeDropdownOpen(true);
                    if (!assigneeQuery && selectedAssigneeLabel) {
                      setAssigneeQuery("");
                    }
                  }}
                  placeholder="Type a Jira username"
                />
              </label>

              {jiraBugDialog.assignee ? (
                <div className="jira-bug-modal__selected-assignee">
                  <div className="jira-bug-modal__selected-assignee-label">Selected assignee</div>
                  <div className="jira-bug-modal__selected-assignee-card">
                    <div>
                      <strong>
                        {selectedAssigneeDetail?.displayName ||
                          selectedAssigneeDetail?.name ||
                          selectedAssigneeLabel ||
                          jiraBugDialog.assignee}
                      </strong>
                      <span style={{ marginLeft: 8, color: "#6b7280", fontSize: "0.95em" }}>
                        {selectedAssigneeDetail?.emailAddress ||
                          selectedAssigneeDetail?.name ||
                          jiraBugDialog.assignee}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="workspace-secondary"
                      onClick={() => {
                        updateJiraBugDialog({ assignee: "" });
                        setAssigneeQuery("");
                        setAssigneeDropdownOpen(true);
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : null}

              {assigneeDropdownOpen ? (
                <div className="jira-bug-modal__assignee-list" role="listbox">
                  {assigneeLoading ? (
                    <div className="jira-bug-modal__assignee-item">Searching Jira...</div>
                  ) : assigneeOptions.length > 0 ? (
                    assigneeOptions.map((assignee) => (
                      <div
                        key={String(assignee.name || assignee.key || assignee.accountId || assignee.displayName)}
                        className="jira-bug-modal__assignee-item"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          updateJiraBugDialog({ assignee: getAssigneeValue(assignee) });
                          setAssigneeQuery("");
                          setAssigneeDropdownOpen(false);
                          setAssigneeLoading(false);
                        }}
                        role="option"
                        aria-selected={getAssigneeValue(assignee) === jiraBugDialog.assignee}
                      >
                        <strong>{assignee.displayName || assignee.name || assignee.key}</strong>
                        <span>{assignee.emailAddress || assignee.name || assignee.key}</span>
                      </div>
                    ))
                  ) : (
                    <div className="jira-bug-modal__assignee-item">No users matched</div>
                  )}
                </div>
              ) : null}

              <div className="workspace-note">The selected username will be sent to Jira as the assignee.</div>
            </div>
          </section>
        </div>

        <div className="jira-bug-modal__footer">
          <div className="jira-bug-modal__footer-note">
            Fields above are editable; the run, case, and description template are prefilled from the selected failure.
          </div>
          <div className="workspace-inline-actions workspace-inline-actions--right">
            <button
              type="button"
              className="workspace-secondary"
              onClick={closeJiraBugDialog}
              disabled={jiraBugDialog.submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="workspace-danger"
              onClick={() => void submitJiraBug()}
              disabled={jiraBugDialog.submitting || !jiraBugDialog.issueType}
            >
              {jiraBugDialog.submitting ? "Creating..." : "Create bug"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return {
    openJiraBugDialog,
    jiraBugDialogNode: dialogNode,
  };
}
