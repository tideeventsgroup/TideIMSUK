/**
 * Must match VAPID_PUBLIC_KEY in amplify/functions/send-escalation-push/resource.ts —
 * the public half is safe to ship to the client, the private half stays a Lambda secret.
 */
export const VAPID_PUBLIC_KEY = 'BCetlSWyQ6mOrWjoij8etPyX_Lz5skpL0alE-AkRFpa359R_fuhpsMrWu_e_V8K3Q5b18lR8Xjy0vdKgKoe2CmM';

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
