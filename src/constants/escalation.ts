/**
 * Incident escalation levels — OSSP Section 5.2 (Build Plan Section 8).
 * This is the command structure, not a generic severity field: the app
 * enforces who can act at each level.
 */

export type EscalationLevelKey = 'Level1' | 'Level2' | 'Level3' | 'Level4';

/**
 * Four-role model: event-control (full admin), fmic (operational,
 * Level 1-2 only), staff (ground roles, own-zone incidents + messaging),
 * view-only (read-only, no declare rights at all).
 */
export type Role = 'event-control' | 'fmic' | 'staff' | 'view-only';

export interface EscalationLevelDef {
  key: EscalationLevelKey;
  number: 1 | 2 | 3 | 4;
  name: string;
  whoActs: string;
  appBehaviour: string;
  /** Only these roles may *declare* this level. Everyone (except view-only) can report/suggest it. */
  canDeclare: Role[];
}

export const ESCALATION_LEVELS: EscalationLevelDef[] = [
  {
    key: 'Level1',
    number: 1,
    name: 'Minor',
    whoActs: 'Ground team manages; reports to Event Control',
    appBehaviour: 'Standard log entry. No alert.',
    canDeclare: ['event-control', 'fmic'],
  },
  {
    key: 'Level2',
    number: 2,
    name: 'Significant',
    whoActs: 'Event Control directs FMIC response; Event Director informed',
    appBehaviour: 'Flags on the live board; notifies Event Control/FMIC.',
    canDeclare: ['event-control', 'fmic'],
  },
  {
    key: 'Level3',
    number: 3,
    name: 'Major',
    whoActs:
      'Tide declares incident level; FMIC commands ground response; agencies notified; programme suspension considered',
    appBehaviour:
      'Push alert to every logged-in device; incident pinned to top of feed; auto-switches suggested radio reference to EMERGENCY (Ch5) note.',
    canDeclare: ['event-control'],
  },
  {
    key: 'Level4',
    number: 4,
    name: 'Critical',
    whoActs:
      '999 called; Police Scotland/emergency services assume scene command; Tide co-ordinates alongside statutory command',
    appBehaviour:
      'Push alert + on-screen banner across all devices; second-level timestamp precision; locks incident from anyone but Event Control.',
    canDeclare: ['event-control'],
  },
];

export function canDeclareLevel(role: Role, level: EscalationLevelKey): boolean {
  const def = ESCALATION_LEVELS.find((l) => l.key === level);
  return def ? def.canDeclare.includes(role) : false;
}

export function escalationDef(level: EscalationLevelKey | string): EscalationLevelDef | undefined {
  return ESCALATION_LEVELS.find((l) => l.key === level);
}

export function roleLabel(role: Role): string {
  return { 'event-control': 'Event Control', fmic: 'FMIC', staff: 'Staff', 'view-only': 'View Only' }[role];
}
