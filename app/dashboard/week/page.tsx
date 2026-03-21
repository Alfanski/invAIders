import type { ReactNode } from 'react';

import { MOCK_WEEK } from '@/lib/mock-week';
import { WeekView } from '@/components/dashboard/week-view';

export default function WeekPage(): ReactNode {
  return <WeekView week={MOCK_WEEK} />;
}
