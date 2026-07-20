import { Search, X } from 'lucide-react';
import { CATEGORIES } from '../constants/taxonomy';
import { ZONES } from '../constants/zones';
import { ESCALATION_LEVELS } from '../constants/escalation';

export interface IncidentFilterState {
  search: string;
  category: string;
  zone: string;
  status: string;
  level: string;
}

export const EMPTY_FILTERS: IncidentFilterState = { search: '', category: 'All', zone: 'All', status: 'All', level: 'All' };

const STATUSES = ['Open', 'InProgress', 'Resolved', 'EscalatedMajor'];

export function IncidentFilters({ value, onChange }: { value: IncidentFilterState; onChange: (v: IncidentFilterState) => void }) {
  const active = value.search || value.category !== 'All' || value.zone !== 'All' || value.status !== 'All' || value.level !== 'All';

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '0 var(--space-4) var(--space-3)',
      }}
    >
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
        <input
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          placeholder="Search narrative, category, zone…"
          aria-label="Search incidents"
          style={{ paddingLeft: 32 }}
        />
      </div>

      <select aria-label="Filter by level" value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value })} style={{ width: 160 }}>
        <option value="All">All levels</option>
        {ESCALATION_LEVELS.map((l) => (
          <option key={l.key} value={l.key}>
            L{l.number} {l.name}
          </option>
        ))}
      </select>

      <select aria-label="Filter by category" value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value })} style={{ width: 170 }}>
        <option value="All">All categories</option>
        {CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      <select aria-label="Filter by zone" value={value.zone} onChange={(e) => onChange({ ...value, zone: e.target.value })} style={{ width: 150 }}>
        <option value="All">All zones</option>
        {ZONES.map((z) => (
          <option key={z.key} value={z.key}>
            {z.label}
          </option>
        ))}
      </select>

      <select aria-label="Filter by status" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })} style={{ width: 140 }}>
        <option value="All">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {active && (
        <button type="button" className="secondary" onClick={() => onChange(EMPTY_FILTERS)}>
          <X size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
          Clear
        </button>
      )}
    </div>
  );
}

export function applyIncidentFilters<T extends { category: string; zone: string; status: string; escalationLevel: string; narrative: string; subcategory?: string | null }>(
  incidents: T[],
  filters: IncidentFilterState,
): T[] {
  const q = filters.search.trim().toLowerCase();
  return incidents.filter((i) => {
    if (filters.category !== 'All' && i.category !== filters.category) return false;
    if (filters.zone !== 'All' && i.zone !== filters.zone) return false;
    if (filters.status !== 'All' && i.status !== filters.status) return false;
    if (filters.level !== 'All' && i.escalationLevel !== filters.level) return false;
    if (q && !`${i.narrative} ${i.category} ${i.subcategory ?? ''} ${i.zone}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
