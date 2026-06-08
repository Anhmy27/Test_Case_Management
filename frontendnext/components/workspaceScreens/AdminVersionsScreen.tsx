"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Dispatch, SetStateAction } from "react";
import { Button, DataTable, Field, INPUT_CLS, SectionCard } from "./shared";

type RecordAny = Record<string, any>;

type Props = {
  versionForm: { projectId: string; name: string; releaseDate: string };
  setVersionForm: Dispatch<SetStateAction<{ projectId: string; name: string; releaseDate: string }>>;
  createVersion: (event: React.FormEvent) => Promise<void>;
  editingVersionId: string;
  startVersionEdit: (version: RecordAny) => void;
  cancelVersionEdit: () => void;
  deleteVersion: (versionId: string) => Promise<void>;
  scopedProjects: RecordAny[];
  versions: RecordAny[];
  projects: RecordAny[];
  matchesSearch: (...values: Array<string | number | undefined | null>) => boolean;
  getId: (value: unknown) => string;
  isProjectScoped: boolean;
  scopedProjectName?: string;
};

export default function AdminVersionsScreen({
  versionForm,
  setVersionForm,
  createVersion,
  editingVersionId,
  startVersionEdit,
  cancelVersionEdit,
  deleteVersion,
  scopedProjects,
  versions,
  projects,
  matchesSearch,
  getId,
  isProjectScoped,
  scopedProjectName,
}: Props) {
  const isEditing = Boolean(editingVersionId);

  return (
    <div className="space-y-5">
      <SectionCard title="Versions" subtitle="Tạo version trong workspace">
        <form className="space-y-4" onSubmit={createVersion}>
          <div className="grid gap-4 sm:grid-cols-3">
            {isProjectScoped ? (
              <Field label="Project">
                <input
                  className={`${INPUT_CLS} bg-slate-50`}
                  value={scopedProjectName || "Selected project"}
                  readOnly
                />
              </Field>
            ) : (
              <Field label="Project">
                <select
                  className={INPUT_CLS}
                  value={versionForm.projectId}
                  onChange={(e) => setVersionForm((prev) => ({ ...prev, projectId: e.target.value }))}
                  required
                >
                  <option value="">Select project</option>
                  {scopedProjects.map((project: RecordAny) => (
                    <option key={getId(project)} value={getId(project)}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Name">
              <input
                className={INPUT_CLS}
                value={versionForm.name}
                onChange={(e) => setVersionForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Release date">
              <input
                type="date"
                className={INPUT_CLS}
                value={versionForm.releaseDate}
                onChange={(e) => setVersionForm((prev) => ({ ...prev, releaseDate: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary">
              {isEditing ? "💾 Update version" : "＋ Create version"}
            </Button>
            {isEditing && (
              <Button type="button" variant="secondary" onClick={cancelVersionEdit}>
                ↩ Cancel
              </Button>
            )}
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Version List">
        <DataTable
          columns={["Version", "Project", "Actions"]}
          rows={versions
            .map((version: RecordAny) => {
              const pid = getId(version.project);
              const proj = projects.find((p: RecordAny) => getId(p) === pid);
              const projectName = proj?.name || pid || "-";
              return { version, projectName };
            })
            .filter(({ version, projectName }: { version: RecordAny; projectName: string }) =>
              matchesSearch(version.name, projectName),
            )
            .map(({ version, projectName }: { version: RecordAny; projectName: string }) => (
              <>
                <div>{version.name}</div>
                <div>{projectName}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => startVersionEdit(version)}>✎ Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteVersion(getId(version))}>🗑 Delete</Button>
                </div>
              </>
            ))}
          emptyText="No versions"
        />
      </SectionCard>
    </div>
  );
}
