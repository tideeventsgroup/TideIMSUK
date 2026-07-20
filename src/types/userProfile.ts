import type { ZoneKey } from '../constants/zones';
import type { StaffStatus } from '../constants/staffStatus';

export interface UserProfileRecord {
  id: string;
  cognitoSub: string;
  name: string;
  role: string;
  agency?: string | null;
  assignedZone?: ZoneKey | null;
  status?: StaffStatus | null;
  statusUpdatedAt?: string | null;
}
