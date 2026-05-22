"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { DataTable, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  versionForm: { projectId: string; name: string; releaseDate: string };
  setVersionForm: Dispatch<SetStateAction<{ projectId: string; name: string; releaseDate: string }>>;
  createVersion: (event: React.FormEvent) => Promise<void>;
  scopedProjects: RecordAny[];
  versions: RecordAny[];
  projects: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  getId: (value: unknown) => string;
};

export default function AdminVersionsScreen({ versionForm, setVersionForm, createVersion, scopedProjects, versions, projects, matchesSearch, getId }: Props) {
  return (
    <div className="workspace-stack">
      <SectionCard title="Versions" subtitle="Tao version trong workspace rieng">
        <form className="workspace-form" onSubmit={createVersion}>
          <div className="workspace-form__grid workspace-form__grid--three">
            <label><span>Project</span><select value={versionForm.projectId} onChange={(e) => setVersionForm((prev) => ({ ...prev, projectId: e.target.value }))} required><option value="">Select</option>{scopedProjects.map((project: RecordAny) => <option key={project._id} value={project._id}>{project.name}</option>)}</select></label>
            <label><span>Name</span><input value={versionForm.name} onChange={(e) => setVersionForm((prev) => ({ ...prev, name: e.target.value }))} required /></label>
            <label><span>Release date</span><input type="date" value={versionForm.releaseDate} onChange={(e) => setVersionForm((prev) => ({ ...prev, releaseDate: e.target.value }))} /></label>
          </div>
          <button className="workspace-primary" type="submit">Create version</button>
        </form>
      </SectionCard>

      <SectionCard title="Version List">
        <DataTable
          columns={["Version", "Project"]}
          rows={versions.map((version: RecordAny) => {
            const pid = getId(version.project);
            const proj = projects.find((p: RecordAny) => String(p._id) === pid);
            const projectName = proj?.name || pid || "-";
            return { version, projectName };
          }).filter(({ version, projectName }: { version: RecordAny; projectName: string }) => matchesSearch(version.name, projectName)).map(({ version, projectName }: { version: RecordAny; projectName: string }) => <><div>{version.name}</div><div>{projectName}</div></>)}
          emptyText="No versions"
        />
      </SectionCard>
    </div>
  );
}