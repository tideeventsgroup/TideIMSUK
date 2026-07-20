import type { CategoryKey } from '../constants/taxonomy';

export type ResidualRating = 'Low' | 'Medium' | 'High' | 'Critical';

export interface RiskControl {
  label: string;
  checked: boolean;
}

export interface Risk {
  id: string;
  eventId: string;
  ref: string;
  hazard: string;
  likelihood: number;
  consequence: number;
  score: number;
  controls: RiskControl[];
  residualRating: ResidualRating;
  linkedIncidentIds: string[];
  linkedCategories: CategoryKey[];
}
