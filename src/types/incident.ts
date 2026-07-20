import type { CategoryKey } from '../constants/taxonomy';
import type { ZoneKey } from '../constants/zones';
import type { EscalationLevelKey } from '../constants/escalation';

export type IncidentStatus = 'Open' | 'InProgress' | 'Resolved' | 'EscalatedMajor';
export type Priority = 'Standard' | 'Major';

export interface IncidentUpdateEntry {
  timestamp: string;
  userId: string;
  userName: string;
  text: string;
}

export interface Incident {
  id: string;
  eventId: string;
  timestamp: string;
  category: CategoryKey;
  subcategory?: string | null;
  zone: ZoneKey;
  status: IncidentStatus;
  priority: Priority;
  escalationLevel: EscalationLevelKey;
  loggedByUserId: string;
  loggedByName: string;
  loggedByRole: string;
  assignedAgency?: string | null;
  narrative: string;
  radioChannel?: number | null;
  lat?: number | null;
  lng?: number | null;
  updates: IncidentUpdateEntry[];
  attachmentKeys?: string[] | null;
  linkedRiskIds?: string[] | null;
  locked: boolean;
  resolvedAt?: string | null;
}
