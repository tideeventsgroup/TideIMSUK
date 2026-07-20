export type StaffStatus = 'OnPost' | 'Break' | 'OffDuty';

export const STAFF_STATUSES: { key: StaffStatus; label: string }[] = [
  { key: 'OnPost', label: 'On post' },
  { key: 'Break', label: 'Break' },
  { key: 'OffDuty', label: 'Off duty' },
];

export function staffStatusLabel(status?: string | null): string {
  return STAFF_STATUSES.find((s) => s.key === status)?.label ?? 'Unknown';
}
