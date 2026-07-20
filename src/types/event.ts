export interface EventInfo {
  id: string;
  name: string;
  venue: string;
  startDate: string;
  endDate: string;
  zones?: string[] | null;
}
