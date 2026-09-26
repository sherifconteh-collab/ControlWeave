// @tier: community
import { redirect } from 'next/navigation';

// Merged into the Evidence page as a tab; kept as a redirect for old links and bookmarks.
export default function EvidencePendingRedirectPage() {
  redirect('/dashboard/evidence?tab=pending');
}
