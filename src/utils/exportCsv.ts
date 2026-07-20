import type { Incident } from '../types/incident';
import { categoryLabel } from '../constants/taxonomy';
import { zoneLabel } from '../constants/zones';
import { escalationDef } from '../constants/escalation';

const COLUMNS = [
  'timestamp',
  'level',
  'category',
  'subcategory',
  'zone',
  'status',
  'priority',
  'loggedByName',
  'loggedByRole',
  'assignedAgency',
  'narrative',
  'radioChannel',
  'updateCount',
  'resolvedAt',
] as const;

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Debrief-ready CSV of the incident log — OSSP Section 30 (Build Plan Section 3/7 Phase 3). */
export function exportIncidentsToCsv(incidents: Incident[], filename = 'tide-ims-incident-log.csv') {
  const rows = incidents.map((i) => [
    i.timestamp,
    `L${escalationDef(i.escalationLevel)?.number ?? ''} ${escalationDef(i.escalationLevel)?.name ?? ''}`,
    categoryLabel(i.category),
    i.subcategory ?? '',
    zoneLabel(i.zone),
    i.status,
    i.priority,
    i.loggedByName,
    i.loggedByRole,
    i.assignedAgency ?? '',
    i.narrative,
    i.radioChannel ?? '',
    (i.updates ?? []).length,
    i.resolvedAt ?? '',
  ]);

  const csv = [COLUMNS.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface HandoverSummary {
  totalOpen: number;
  totalInProgress: number;
  byCategory: Record<string, number>;
  byZone: Record<string, number>;
  criticalOrMajor: Incident[];
}

/**
 * Structured summary feeding the shift-handover / debrief flow (Section 11
 * "Shift handover summary" / "Post-event debrief draft"). This is the
 * structured data an AI drafting step would summarise into plain English —
 * that Lambda call is not wired up in this scaffold.
 */
export function buildHandoverSummary(incidents: Incident[]): HandoverSummary {
  const byCategory: Record<string, number> = {};
  const byZone: Record<string, number> = {};

  for (const i of incidents) {
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    byZone[i.zone] = (byZone[i.zone] ?? 0) + 1;
  }

  return {
    totalOpen: incidents.filter((i) => i.status === 'Open').length,
    totalInProgress: incidents.filter((i) => i.status === 'InProgress').length,
    byCategory,
    byZone,
    criticalOrMajor: incidents.filter((i) => i.escalationLevel === 'Level3' || i.escalationLevel === 'Level4'),
  };
}
