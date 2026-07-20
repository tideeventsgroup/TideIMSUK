export type ZoneKey = 'ZoneA' | 'ZoneB' | 'ZoneC' | 'ZoneD' | 'Harbourside' | 'AccessEgress' | 'WholeSite';

export interface ZoneDef {
  key: ZoneKey;
  label: string;
  /**
   * [lng, lat] polygon vertices for GPS reverse-mapping (Section 10).
   * Placeholder — trace these once from the Official Site Plan 2026
   * before relying on auto zone-suggestion. Empty polygon = no auto-match,
   * app falls back to manual selection (never blocks logging).
   */
  polygon: [number, number][];
}

export const ZONES: ZoneDef[] = [
  { key: 'ZoneA', label: 'Zone A', polygon: [] },
  { key: 'ZoneB', label: 'Zone B', polygon: [] },
  { key: 'ZoneC', label: 'Zone C', polygon: [] },
  { key: 'ZoneD', label: 'Zone D', polygon: [] },
  { key: 'Harbourside', label: 'Harbourside', polygon: [] },
  { key: 'AccessEgress', label: 'Access / Egress', polygon: [] },
  { key: 'WholeSite', label: 'Whole Site', polygon: [] },
];

export function zoneLabel(key: ZoneKey | string): string {
  return ZONES.find((z) => z.key === key)?.label ?? key;
}
