export interface ZoneReassignment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  fromZone?: string | null;
  toZone: string;
  reassignedByUserId: string;
  reassignedByName: string;
  timestamp: string;
}

export interface ZoneClearance {
  id: string;
  eventId: string;
  zone: string;
  cleared: boolean;
  confirmedByUserId: string;
  confirmedByName: string;
  timestamp: string;
}

export interface ShiftHandoverNote {
  id: string;
  eventId: string;
  openItems?: string | null;
  watchItems?: string | null;
  whereaboutsNote?: string | null;
  authoredByUserId: string;
  authoredByName: string;
  timestamp: string;
}

export interface IncidentDebrief {
  id: string;
  incidentId: string;
  eventId: string;
  whatHappened: string;
  whatWorkedWell?: string | null;
  whatToChange?: string | null;
  authoredByUserId: string;
  authoredByName: string;
  timestamp: string;
}
