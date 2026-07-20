/**
 * Must match VAPID_PUBLIC_KEY in amplify/functions/send-escalation-push/resource.ts —
 * the public half is safe to ship to the client, the private half stays a Lambda secret.
 */
export const VAPID_PUBLIC_KEY = 'BIamM5rx-m24Bktr9XS9X0BVZbmnNM5fLw8VJhBBHRplbXW1gfbw-yh2249o0lhBkG2AHrX4bdETBaY78JzI25U';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
