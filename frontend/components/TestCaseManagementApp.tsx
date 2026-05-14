"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, getId, userName } from "@/lib/api";

type RecordAny = Record<string, any>;

export default function TestCaseManagementApp() {
  const [token, setToken] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem("tcm_token") || "";
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeTab, setActiveTab] = useState<"overview" | "admin" | "execution" | "dashboard">("overview");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [currentUser, setCurrentUser] = useState<RecordAny | null>(null);
  const [message, setMessage] = useState<string>("");

  const [users, setUsers] = useState<RecordAny[]>([]);
  const [projects, setProjects] = useState<RecordAny[]>([]);
  const [versions, setVersions] = useState<RecordAny[]>([]);
  const [testCases, setTestCases] = useState<RecordAny[]>([]);
  const [plans, setPlans] = useState<RecordAny[]>([]);
  const [runs, setRuns] = useState<RecordAny[]>([]);
  const [dashboard, setDashboard] = useState<RecordAny | null>(null);

  const [projectForm, setProjectForm] = useState({ name: "", code: "", description: "" });
  const [versionForm, setVersionForm] = useState({ projectId: "", name: "", releaseDate: "" });
  const [testCaseForm, setTestCaseForm] = useState({
    projectId: "",
    caseKey: "",
    title: "",
    description: "",
    action: "",
    expected: "",
  });
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    projectId: "",
    versionId: "",
    caseIds: [] as string[],
  });
  const [runForm, setRunForm] = useState({ testPlanId: "", name: "" });
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [assignDraft, setAssignDraft] = useState<Record<string, { ownerId: string; assigneeIds: string[] }>>({});
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [myItems, setMyItems] = useState<RecordAny[]>([]);

  const isAdmin = currentUser?.role === "admin";

  const availableTabs = isAdmin
    ? ["overview", "admin", "execution", "dashboard"]
    : ["overview", "execution", "dashboard"];
  const selectedTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];

  const selectedProjectId = useMemo(() => {
    return planForm.projectId || versionForm.projectId || testCaseForm.projectId;
  }, [planForm.projectId, versionForm.projectId, testCaseForm.projectId]);

  const filteredVersions = useMemo(() => {
    if (!selectedProjectId) {
      return versions;
    }
    return versions.filter((version) => getId(version.project) === selectedProjectId);
  }, [versions, selectedProjectId]);

  const filteredCases = useMemo(() => {
    if (!planForm.projectId) {
      return testCases;
    }
    return testCases.filter((testCase) => getId(testCase.project) === planForm.projectId);
  }, [testCases, planForm.projectId]);

  const refreshAll = useCallback(async (currentToken: string, role?: string) => {
    const projectResp = await apiRequest<{ projects: RecordAny[] }>("/api/projects", currentToken);
    const versionResp = await apiRequest<{ versions: RecordAny[] }>("/api/versions", currentToken);
    const caseResp = await apiRequest<{ testCases: RecordAny[] }>("/api/test-cases", currentToken);
    const planResp = await apiRequest<{ testPlans: RecordAny[] }>("/api/test-plans", currentToken);
    const runResp = await apiRequest<{ testRuns: RecordAny[] }>("/api/test-runs", currentToken);
    const dashboardResp = await apiRequest<RecordAny>("/api/dashboard", currentToken);

    setProjects(projectResp.projects || []);
    setVersions(versionResp.versions || []);
    setTestCases(caseResp.testCases || []);
    setPlans(planResp.testPlans || []);
    setRuns(runResp.testRuns || []);
    setDashboard(dashboardResp);

    if ((role || currentUser?.role) === "admin") {
      const userResp = await apiRequest<{ users: RecordAny[] }>("/api/users", currentToken);
      setUsers(userResp.users || []);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<{ user: RecordAny }>("/api/auth/me", token)
      .then(async (resp) => {
        setCurrentUser(resp.user);
        await refreshAll(token, resp.user.role);
      })
      .catch(() => {
        window.localStorage.removeItem("tcm_token");
        setToken("");
      });
  }, [token, refreshAll]);

  function selectPlanForAssignment(planId: string) {
    setSelectedPlanId(planId);

    const selectedPlan = plans.find((plan) => String(plan._id) === planId);
    if (!selectedPlan) {
      setAssignDraft({});
      return;
    }

    const nextDraft: Record<string, { ownerId: string; assigneeIds: string[] }> = {};
    (selectedPlan.items || []).forEach((item: any) => {
      nextDraft[String(item._id)] = {
        ownerId: getId(item.owner),
        assigneeIds: Array.isArray(item.assignees) ? item.assignees.map((u: any) => getId(u)) : [],
      };
    });

    setAssignDraft(nextDraft);
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : { name: authForm.name, email: authForm.email, password: authForm.password };

      const response = await apiRequest<{ token: string; user: RecordAny }>(endpoint, undefined, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setToken(response.token);
      setCurrentUser(response.user);
      window.localStorage.setItem("tcm_token", response.token);
      await refreshAll(response.token, response.user.role);
      setMessage(`Xin chao ${response.user.name}. Dang nhap thanh cong.`);
    } catch (error: any) {
      setMessage(error.message || "Auth failed");
    }
  }

  async function withAction(action: () => Promise<void>) {
    try {
      setMessage("");
      await action();
      if (token) {
        await refreshAll(token);
      }
    } catch (error: any) {
      setMessage(error.message || "Action failed");
    }
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/projects", token, {
        method: "POST",
        body: JSON.stringify(projectForm),
      });
      setProjectForm({ name: "", code: "", description: "" });
      setMessage("Da tao project");
    });
  }

  async function createVersion(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/versions", token, {
        method: "POST",
        body: JSON.stringify(versionForm),
      });
      setVersionForm({ projectId: versionForm.projectId, name: "", releaseDate: "" });
      setMessage("Da tao version");
    });
  }

  async function createCase(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/test-cases", token, {
        method: "POST",
        body: JSON.stringify({
          projectId: testCaseForm.projectId,
          caseKey: testCaseForm.caseKey,
          title: testCaseForm.title,
          description: testCaseForm.description,
          steps: [{ action: testCaseForm.action, expected: testCaseForm.expected }],
        }),
      });
      setTestCaseForm({
        projectId: testCaseForm.projectId,
        caseKey: "",
        title: "",
        description: "",
        action: "",
        expected: "",
      });
      setMessage("Da tao test case");
    });
  }

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/test-plans", token, {
        method: "POST",
        body: JSON.stringify(planForm),
      });
      setPlanForm({
        name: "",
        description: "",
        projectId: planForm.projectId,
        versionId: planForm.versionId,
        caseIds: [],
      });
      setMessage("Da tao test plan");
    });
  }

  async function saveAssignments(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlanId) {
      setMessage("Hay chon test plan truoc");
      return;
    }

    await withAction(async () => {
      const assignments = Object.entries(assignDraft).map(([itemId, value]) => ({
        itemId,
        ownerId: value.ownerId,
        assigneeIds: value.assigneeIds,
      }));

      await apiRequest(`/api/test-plans/${selectedPlanId}/assign`, token, {
        method: "PUT",
        body: JSON.stringify({ assignments }),
      });

      setMessage("Da assign owner va assignees");
    });
  }

  async function startRun(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/test-runs", token, {
        method: "POST",
        body: JSON.stringify(runForm),
      });
      setRunForm({ testPlanId: "", name: "" });
      setMessage("Da start test run");
    });
  }

  async function endRun(runId: string) {
    await withAction(async () => {
      await apiRequest(`/api/test-runs/${runId}/end`, token, { method: "PATCH" });
      setMessage("Da end test run");
    });
  }

  async function loadMyItems(runId: string) {
    setSelectedRunId(runId);
    try {
      const response = await apiRequest<{ results: RecordAny[] }>(`/api/test-runs/${runId}/my-items`, token);
      setMyItems(response.results || []);
    } catch (error: any) {
      setMessage(error.message || "Khong tai duoc danh sach case");
    }
  }

  async function updateResult(resultId: string, status: "pass" | "fail" | "blocked", note: string) {
    if (!selectedRunId) {
      return;
    }

    await withAction(async () => {
      await apiRequest(`/api/test-runs/${selectedRunId}/results/${resultId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status, note }),
      });
      await loadMyItems(selectedRunId);
      setMessage("Da cap nhat ket qua test");
    });
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await withAction(async () => {
      await apiRequest("/api/users", token, {
        method: "POST",
        body: JSON.stringify(newUserForm),
      });
      setNewUserForm({ name: "", email: "", password: "", role: "employee" });
      setMessage("Admin da tao user moi");
    });
  }

  function logout() {
    window.localStorage.removeItem("tcm_token");
    setToken("");
    setCurrentUser(null);
    setActiveTab("overview");
    setUsers([]);
    setProjects([]);
    setVersions([]);
    setTestCases([]);
    setPlans([]);
    setRuns([]);
    setDashboard(null);
  }

  function toggleAuthMode() {
    // lightweight debug: ensure click fires and state toggles
    // eslint-disable-next-line no-console
    console.debug("toggleAuthMode - before:", authMode);
    setAuthMode((prev) => (prev === "login" ? "register" : "login"));
    // eslint-disable-next-line no-console
    console.debug("toggleAuthMode - after (scheduled)");
  }

  if (!token || !currentUser) {
    return (
      <main className="shell">
        <div className="hero">
          <h1>Test Case Management</h1>
          <p>Dang ky mac dinh la nhan vien. Admin co the tao user va phan quyen.</p>
        </div>
        <section className="panel" style={{ margin: "1rem" }}>
          <h2>{authMode === "login" ? "Dang nhap" : "Dang ky"}</h2>
          <form onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <div className="field" style={{ marginBottom: "0.5rem" }}>
                <span>Ho ten</span>
                <input
                  value={authForm.name}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div className="field" style={{ marginBottom: "0.5rem" }}>
              <span>Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: "0.5rem" }}>
              <span>Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn btn-primary">
                {authMode === "login" ? "Dang nhap" : "Dang ky"}
              </button>
              <button type="button" className="btn btn-alt" onClick={toggleAuthMode}>
                Chuyen sang {authMode === "login" ? "Dang ky" : "Dang nhap"}
              </button>
            </div>
          </form>
          {message && <p style={{ marginTop: "0.6rem" }}>{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="hero">
        <h1>Flow test case fullstack</h1>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
          <span className="tag">{currentUser.name}</span>
          <span className="tag">{currentUser.role}</span>
          <button className="btn btn-alt" onClick={logout}>Dang xuat</button>
        </div>
        {message && <p style={{ marginTop: "0.6rem" }}>{message}</p>}
      </div>

      <section className="panel" style={{ margin: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {availableTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`btn ${selectedTab === tab ? "btn-primary" : "btn-alt"}`}
              onClick={() => setActiveTab(tab as typeof activeTab)}
            >
              {tab === "overview" && "Tong quan"}
              {tab === "admin" && "Quan tri"}
              {tab === "execution" && "Test run"}
              {tab === "dashboard" && "Dashboard"}
            </button>
          ))}
        </div>

        {selectedTab === "overview" && (
          <div className="layout-grid">
            <section className="panel">
              <h2>Tong quan du lieu</h2>
              <div className="metric-grid">
                <div className="metric"><span>Total runs</span><b>{dashboard?.summary?.totalRuns || 0}</b></div>
                <div className="metric"><span>Running runs</span><b>{dashboard?.summary?.runningRuns || 0}</b></div>
                <div className="metric"><span>Total cases</span><b>{dashboard?.summary?.totalCases || 0}</b></div>
                <div className="metric"><span>Executed</span><b>{dashboard?.summary?.executed || 0}</b></div>
              </div>
            </section>

            <section className="panel">
              <h2>Danh muc nhanh</h2>
              <div className="list">
                <div className="item"><b>Projects</b><span>{projects.length}</span></div>
                <div className="item"><b>Versions</b><span>{versions.length}</span></div>
                <div className="item"><b>Test Cases</b><span>{testCases.length}</span></div>
                <div className="item"><b>Test Plans</b><span>{plans.length}</span></div>
                <div className="item"><b>Test Runs</b><span>{runs.length}</span></div>
                <div className="item"><b>Users</b><span>{users.length}</span></div>
              </div>
            </section>

            <section className="panel">
              <h2>Users</h2>
              <div className="list">
                {(users.length > 0 ? users : [currentUser]).map((user) => (
                  <div className="item" key={user._id || user.email}>
                    <b>{user.name}</b>
                    <span>{user.email}</span>
                    <span className="tag">{user.role}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {selectedTab === "admin" && isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <section className="panel">
              <h2>1) Tao Project</h2>
              <form onSubmit={createProject}>
                <div className="row">
                  <label className="field"><span>Project name</span><input value={projectForm.name} onChange={(e) => setProjectForm((p) => ({ ...p, name: e.target.value }))} required /></label>
                  <label className="field"><span>Code</span><input value={projectForm.code} onChange={(e) => setProjectForm((p) => ({ ...p, code: e.target.value }))} required /></label>
                </div>
                <label className="field"><span>Description</span><textarea rows={2} value={projectForm.description} onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))} /></label>
                <button className="btn btn-primary" type="submit" style={{ marginTop: "0.5rem" }}>Tao project</button>
              </form>
            </section>

            <section className="panel">
              <h2>2) Tao Test Case</h2>
              <form onSubmit={createCase}>
                <div className="row">
                  <label className="field"><span>Project</span><select value={testCaseForm.projectId} onChange={(e) => setTestCaseForm((p) => ({ ...p, projectId: e.target.value }))} required><option value="">Chon</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
                  <label className="field"><span>Case key</span><input value={testCaseForm.caseKey} onChange={(e) => setTestCaseForm((p) => ({ ...p, caseKey: e.target.value }))} required /></label>
                </div>
                <label className="field"><span>Title</span><input value={testCaseForm.title} onChange={(e) => setTestCaseForm((p) => ({ ...p, title: e.target.value }))} required /></label>
                <label className="field"><span>Description</span><textarea rows={2} value={testCaseForm.description} onChange={(e) => setTestCaseForm((p) => ({ ...p, description: e.target.value }))} /></label>
                <div className="row">
                  <label className="field"><span>Step action</span><input value={testCaseForm.action} onChange={(e) => setTestCaseForm((p) => ({ ...p, action: e.target.value }))} required /></label>
                  <label className="field"><span>Expected</span><input value={testCaseForm.expected} onChange={(e) => setTestCaseForm((p) => ({ ...p, expected: e.target.value }))} required /></label>
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: "0.5rem" }}>Tao test case</button>
              </form>
            </section>

            <section className="panel">
              <h2>3) Tao Version</h2>
              <form onSubmit={createVersion}>
                <div className="row">
                  <label className="field"><span>Project</span><select value={versionForm.projectId} onChange={(e) => setVersionForm((p) => ({ ...p, projectId: e.target.value }))} required><option value="">Chon</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
                  <label className="field"><span>Version name</span><input value={versionForm.name} onChange={(e) => setVersionForm((p) => ({ ...p, name: e.target.value }))} required /></label>
                  <label className="field"><span>Release date</span><input type="date" value={versionForm.releaseDate} onChange={(e) => setVersionForm((p) => ({ ...p, releaseDate: e.target.value }))} /></label>
                </div>
                <button className="btn btn-primary" type="submit">Tao version</button>
              </form>
            </section>

            <section className="panel">
              <h2>4) Tao Test Plan (gan Version)</h2>
              <form onSubmit={createPlan}>
                <div className="row">
                  <label className="field"><span>Project</span><select value={planForm.projectId} onChange={(e) => setPlanForm((p) => ({ ...p, projectId: e.target.value, versionId: "" }))} required><option value="">Chon</option>{projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
                  <label className="field"><span>Version</span><select value={planForm.versionId} onChange={(e) => setPlanForm((p) => ({ ...p, versionId: e.target.value }))} required><option value="">Chon</option>{filteredVersions.filter((version) => getId(version.project) === planForm.projectId).map((version) => <option key={version._id} value={version._id}>{version.name}</option>)}</select></label>
                </div>
                <div className="row">
                  <label className="field"><span>Plan name</span><input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} required /></label>
                  <label className="field"><span>Description</span><input value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))} /></label>
                </div>
                <label className="field"><span>Case list</span>
                  <select
                    multiple
                    value={planForm.caseIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((option) => option.value);
                      setPlanForm((p) => ({ ...p, caseIds: selected }));
                    }}
                    size={Math.min(8, Math.max(3, filteredCases.length))}
                  >
                    {filteredCases.map((item) => (
                      <option value={item._id} key={item._id}>{item.caseKey} - {item.title}</option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary" type="submit" style={{ marginTop: "0.5rem" }}>Tao test plan</button>
              </form>
            </section>

            <section className="panel">
              <h2>5) Assign owner + assignees</h2>
              <form onSubmit={saveAssignments}>
                <label className="field">
                  <span>Test Plan</span>
                  <select value={selectedPlanId} onChange={(e) => selectPlanForAssignment(e.target.value)} required>
                    <option value="">Chon test plan</option>
                    {plans.map((plan) => <option value={plan._id} key={plan._id}>{plan.name}</option>)}
                  </select>
                </label>

                <div className="list" style={{ marginTop: "0.6rem" }}>
                  {(plans.find((plan) => String(plan._id) === selectedPlanId)?.items || []).map((item: any) => (
                    <div className="item" key={item._id}>
                      <b>{item.testCase?.caseKey} - {item.testCase?.title}</b>
                      <div className="row">
                        <label className="field">
                          <span>Owner</span>
                          <select
                            value={assignDraft[item._id]?.ownerId || ""}
                            onChange={(e) => setAssignDraft((prev) => ({
                              ...prev,
                              [item._id]: {
                                ownerId: e.target.value,
                                assigneeIds: prev[item._id]?.assigneeIds || [],
                              },
                            }))}
                          >
                            <option value="">Chua gan</option>
                            {users.map((user) => <option key={user._id} value={user._id}>{user.name} ({user.role})</option>)}
                          </select>
                        </label>
                        <label className="field">
                          <span>Assignees</span>
                          <select
                            multiple
                            value={assignDraft[item._id]?.assigneeIds || []}
                            onChange={(e) => {
                              const selected = Array.from(e.target.selectedOptions).map((option) => option.value);
                              setAssignDraft((prev) => ({
                                ...prev,
                                [item._id]: {
                                  ownerId: prev[item._id]?.ownerId || "",
                                  assigneeIds: selected,
                                },
                              }));
                            }}
                          >
                            {users.map((user) => <option key={user._id} value={user._id}>{user.name} ({user.role})</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: "0.5rem" }}>Luu assign</button>
              </form>
            </section>

            <section className="panel">
              <h2>Admin user management</h2>
              <form onSubmit={createUser}>
                <div className="row">
                  <label className="field"><span>Name</span><input value={newUserForm.name} onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))} required /></label>
                  <label className="field"><span>Email</span><input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))} required /></label>
                  <label className="field"><span>Password</span><input type="password" value={newUserForm.password} onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))} required /></label>
                  <label className="field"><span>Role</span><select value={newUserForm.role} onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value }))}><option value="employee">employee</option><option value="admin">admin</option></select></label>
                </div>
                <button className="btn btn-primary" type="submit">Tao user</button>
              </form>
            </section>
          </div>
        )}

        {selectedTab === "execution" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <section className="panel">
              <h2>6) Start Test Run</h2>
              <form onSubmit={startRun}>
                <div className="row">
                  <label className="field"><span>Test Plan</span><select value={runForm.testPlanId} onChange={(e) => setRunForm((p) => ({ ...p, testPlanId: e.target.value }))} required><option value="">Chon</option>{plans.map((plan) => <option value={plan._id} key={plan._id}>{plan.name}</option>)}</select></label>
                  <label className="field"><span>Run name</span><input value={runForm.name} onChange={(e) => setRunForm((p) => ({ ...p, name: e.target.value }))} required /></label>
                </div>
                <button className="btn btn-primary" type="submit">Start run</button>
              </form>
            </section>

            <section className="panel">
              <h2>7) Nhan vien run test (pass/fail + note)</h2>
              <div className="field">
                <span>Chon test run</span>
                <select value={selectedRunId} onChange={(e) => loadMyItems(e.target.value)}>
                  <option value="">Chon run</option>
                  {runs.map((run) => <option key={run._id} value={run._id}>{run.name} ({run.status})</option>)}
                </select>
              </div>

              <div className="list" style={{ marginTop: "0.6rem" }}>
                {myItems.map((item) => {
                  const currentNote = item.note || "";
                  return (
                    <div className="item" key={item._id}>
                      <div>
                        <b>{item.testCase?.caseKey} - {item.testCase?.title}</b>
                        <div style={{ fontSize: "0.84rem", color: "#475569" }}>
                          Owner: {userName(item.owner)} | Assignees: {(item.assignees || []).map((assignee: any) => userName(assignee)).join(", ") || "None"}
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        defaultValue={currentNote}
                        onBlur={(event) => {
                          const note = event.currentTarget.value;
                          setMyItems((prev) => prev.map((row) => (row._id === item._id ? { ...row, note } : row)));
                        }}
                        placeholder="Nhap note test"
                      />
                      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                        <button className="btn btn-primary" type="button" onClick={() => updateResult(item._id, "pass", (myItems.find((r) => r._id === item._id)?.note) || "")}>Pass</button>
                        <button className="btn btn-warn" type="button" onClick={() => updateResult(item._id, "fail", (myItems.find((r) => r._id === item._id)?.note) || "")}>Fail</button>
                        <button className="btn btn-alt" type="button" onClick={() => updateResult(item._id, "blocked", (myItems.find((r) => r._id === item._id)?.note) || "")}>Blocked</button>
                        <span className={`tag ${item.status === "pass" ? "status-pass" : item.status === "fail" ? "status-fail" : item.status === "blocked" ? "status-blocked" : ""}`}>{item.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {isAdmin && (
              <section className="panel">
                <h2>8) End Test Run</h2>
                <div className="list">
                  {runs.map((run) => (
                    <div className="item" key={run._id}>
                      <b>{run.name}</b>
                      <span>Status: {run.status}</span>
                      {run.status === "running" && (
                        <button className="btn btn-warn" type="button" onClick={() => endRun(run._id)}>End run</button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {selectedTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <section className="panel">
              <h2>9) Dashboard (filter + thong ke)</h2>
              <div className="metric-grid">
                <div className="metric"><span>Total runs</span><b>{dashboard?.summary?.totalRuns || 0}</b></div>
                <div className="metric"><span>Running runs</span><b>{dashboard?.summary?.runningRuns || 0}</b></div>
                <div className="metric"><span>Total cases</span><b>{dashboard?.summary?.totalCases || 0}</b></div>
                <div className="metric"><span>Executed</span><b>{dashboard?.summary?.executed || 0}</b></div>
                <div className="metric"><span>Pass</span><b className="status-pass">{dashboard?.summary?.pass || 0}</b></div>
                <div className="metric"><span>Fail</span><b className="status-fail">{dashboard?.summary?.fail || 0}</b></div>
                <div className="metric"><span>Blocked</span><b className="status-blocked">{dashboard?.summary?.blocked || 0}</b></div>
                <div className="metric"><span>Completion</span><b>{dashboard?.summary?.completionRate || 0}%</b></div>
                <div className="metric"><span>Pass rate</span><b>{dashboard?.summary?.passRate || 0}%</b></div>
              </div>
            </section>

            <section className="panel">
              <h2>Van ban loc</h2>
              <div className="list">
                <div className="item"><b>Projects</b><span>{projects.length}</span></div>
                <div className="item"><b>Versions</b><span>{versions.length}</span></div>
                <div className="item"><b>Test Cases</b><span>{testCases.length}</span></div>
                <div className="item"><b>Test Plans</b><span>{plans.length}</span></div>
                <div className="item"><b>Test Runs</b><span>{runs.length}</span></div>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}