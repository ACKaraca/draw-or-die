import type { Metadata } from 'next';

import { ModerationQueue } from '@/components/ModerationQueue';

// Intentionally unlinked; the page renders the regular 404 unless the moderation API authorizes the viewer.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminModerationPage(): React.JSX.Element {
  return <ModerationQueue />;
}
