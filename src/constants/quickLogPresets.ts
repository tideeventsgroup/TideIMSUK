import type { CategoryKey } from './taxonomy';

export interface QuickLogPreset {
  key: string;
  label: string;
  category: CategoryKey;
  narrative: string;
}

// One-tap starting points for the incidents logged most often — sets
// category and a narrative skeleton the Loggist finishes off, zone stays
// whatever GPS/manual entry already has it as.
export const QUICK_LOG_PRESETS: QuickLogPreset[] = [
  { key: 'lost-child', label: 'Lost child', category: 'MissingPerson', narrative: 'Child reported separated from parent/guardian. Description: ' },
  { key: 'minor-medical', label: 'Minor medical', category: 'Medical', narrative: 'Minor medical issue — first aid attending. ' },
  { key: 'welfare', label: 'Welfare check', category: 'Welfare', narrative: 'Welfare concern raised for an attendee. ' },
  { key: 'lost-property', label: 'Lost property', category: 'LostProperty', narrative: 'Item reported lost: ' },
  { key: 'crowd-density', label: 'Crowd building', category: 'CrowdMgmt', narrative: 'Crowd density building, monitoring closely. ' },
  { key: 'suspicious', label: 'Suspicious item/activity', category: 'CTSuspicious', narrative: 'Suspicious item/behaviour reported: ' },
];
