"use client";

import type { ReactNode } from "react";

export function SectionCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="workspace-card">
      <div
        className="workspace-card__header"
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}
      >
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="workspace-inline-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: ReactNode[];
  emptyText: string;
}) {
  const columnStyle = {
    gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
  };

  return (
    <div className="workspace-table">
      <div className="workspace-table__head" style={columnStyle}>
        {columns.map((column) => (
          <div key={column}>{column}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="workspace-table__empty">{emptyText}</div>
      ) : (
        <div className="workspace-table__body">
          {rows.map((row, index) => (
            <div key={index} className="workspace-table__row" style={columnStyle}>
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}