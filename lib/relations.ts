import type { Relation } from '@/lib/types';

export const RELATIONS: { id: Relation; icon: string; ur: string; en: string }[] = [
  { id: 'mother', icon: '👩', ur: 'امی', en: 'Mother' },
  { id: 'father', icon: '👨', ur: 'ابو', en: 'Father' },
  { id: 'brother', icon: '🧑', ur: 'بھائی', en: 'Brother' },
  { id: 'sister', icon: '👧', ur: 'بہن', en: 'Sister' },
  { id: 'husband', icon: '🤵', ur: 'شوہر', en: 'Husband' },
  { id: 'friend', icon: '🤝', ur: 'دوست', en: 'Friend' },
  { id: 'other', icon: '👤', ur: 'دیگر', en: 'Other' },
];
