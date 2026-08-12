import type { AppD1 } from "@/db";

export const IMPROVEMENT_STATUSES = ["open", "done"] as const;
export type ImprovementStatus = (typeof IMPROVEMENT_STATUSES)[number];
export const IMPROVEMENT_STATUS_LABELS: Record<ImprovementStatus, string> = {
  open: "開放中",
  done: "已完成",
};

export type ImprovementNote = {
  id: string;
  body: string;
  status: ImprovementStatus;
  createdAt: string;
  updatedAt: string;
};

type ImprovementRow = {
  id: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapImprovement(row: ImprovementRow): ImprovementNote {
  return {
    id: row.id,
    body: row.body,
    status: row.status === "done" ? "done" : "open",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadImprovementNotes(d1: AppD1): Promise<ImprovementNote[]> {
  const result = await d1.prepare("SELECT id, body, status, created_at, updated_at FROM improvement_notes WHERE archived_at IS NULL ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, updated_at DESC, id DESC").all<ImprovementRow>();
  return result.results.map(mapImprovement);
}
