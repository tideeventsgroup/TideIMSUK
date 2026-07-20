/**
 * Incident escalation levels — OSSP Section 5.2 (Build Plan Section 8).
 * This is the command structure, not a generic severity field: the app
 * enforces who can act at each level.
 */

export type EscalationLevelKey = 'Level1' | 'Level2' | 'Level3' | 'Level4';
export type Role = 'Admin' | 'Controller' | 'Loggist' | 'Steward';

export interface EscalationLevelDef {
  key: EscalationLevelKey;
  number: 1 | 2 | 3 | 4;
  name: string;
  whoActs: string;
  appBehaviour: string;
  /** Only these roles may *declare* this level. Everyone can report/suggest it. */
  canDeclare: Role[];
}

export const ESCALATION_LEVELS: EscalationLevelDef[] = [
  {
    key: 'Level1',
    number: 1,
    name: 'Minor',
    whoActs: 'Ground team manages; reports to Event Control',
    appBehaviour: 'Standard log entry. No alert.',
    canDeclare: ['Admin', 'Controller', 'Loggist', 'Steward'],
  },
  {
    key: 'Level2',
    number: 2,
    name: 'Significant',
    whoActs: 'Event Control directs FMIC response; Event Director informed',
    appBehaviour: 'Flags on the live board; notifies Controller role.',
    canDeclare: ['Admin', 'Controller', 'Loggist', 'Steward'],
  },
  {
    key: 'Level3',
    number: 3,
    name: 'Major',
    whoActs:
      'Tide declares incident level; FMIC commands ground response; agencies notified; programme suspension considered',
    appBehaviour:
      'Push alert to every logged-in device; incident pinned to top of feed; auto-switches suggested radio reference to EMERGENCY (Ch5) note.',
    canDeclare: ['Admin', 'Controller'],
  },
  {
    key: 'Level4',
    number: 4,
    name: 'Critical',
    whoActs:
      '999 called; Police Scotland/emergency services assume scene command; Tide co-ordinates alongside statutory command',
    appBehaviour:
      'Push alert + on-screen banner across all devices; second-level timestamp precision; locks incident from anyone but Controller/Admin roles.',
    canDeclare: ['Admin', 'Controller'],
  },
];

export function canDeclareLevel(role: Role, level: EscalationLevelKey): boolean {
  const def = ESCALATION_LEVELS.find((l) => l.key === level);
  return def ? def.canDeclare.includes(role) : false;
}

export function escalationDef(level: EscalationLevelKey | string): EscalationLevelDef | undefined {
  return ESCALATION_LEVELS.find((l) => l.key === level);
}
