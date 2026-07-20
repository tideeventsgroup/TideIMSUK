import { client } from '../data/client';
import type { ZoneKey } from '../constants/zones';
import type { StaffStatus } from '../constants/staffStatus';

/** Self-service upsert of the caller's own UserProfile row (owner-authorized create/update). */
export async function setMyAssignedZone(userId: string, name: string, role: string, zone: ZoneKey) {
  const { data: existing } = await client.models.UserProfile.list({
    filter: { cognitoSub: { eq: userId } },
  });

  if (existing[0]) {
    await client.models.UserProfile.update({ id: existing[0].id, assignedZone: zone });
  } else {
    await client.models.UserProfile.create({ cognitoSub: userId, name, role, assignedZone: zone });
  }
}

/** Self-service shift-presence toggle (On post / Break / Off duty) — see MyStatusToggle.tsx. */
export async function setMyStatus(userId: string, name: string, role: string, status: StaffStatus) {
  const { data: existing } = await client.models.UserProfile.list({
    filter: { cognitoSub: { eq: userId } },
  });

  const statusUpdatedAt = new Date().toISOString();
  if (existing[0]) {
    await client.models.UserProfile.update({ id: existing[0].id, status, statusUpdatedAt });
  } else {
    await client.models.UserProfile.create({ cognitoSub: userId, name, role, status, statusUpdatedAt });
  }
}
