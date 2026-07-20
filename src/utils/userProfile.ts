import { client } from '../data/client';
import type { ZoneKey } from '../constants/zones';

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
