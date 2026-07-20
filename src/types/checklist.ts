export type ChecklistItemStatus = 'Pending' | 'Done';

export interface ChecklistTemplateItem {
  label: string;
  requiresPhoto: boolean;
  requiresSignoff: boolean;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  recurring: boolean;
  items: ChecklistTemplateItem[];
}

export interface ChecklistInstanceItem {
  label: string;
  requiresPhoto: boolean;
  requiresSignoff: boolean;
  status: ChecklistItemStatus;
  completedBy?: string | null;
  completedAt?: string | null;
  photoS3Key?: string | null;
  notes?: string | null;
}

export interface ChecklistInstance {
  id: string;
  eventId: string;
  templateId?: string | null;
  title: string;
  date: string;
  assignee?: string | null;
  dueAt?: string | null;
  sourceIncidentId?: string | null;
  items: ChecklistInstanceItem[];
}
