import { notifyContacts, raiseAlert } from '@/lib/alerts';
import type { Deps } from '@/lib/deps';
import { verifyPin } from '@/lib/guard';
import { phoneLostText } from '@/lib/messages';
import { normalizePkPhone } from '@/lib/phone';
import { shareExpiry } from '@/lib/time';

export type HelpAction = 'help' | 'ok';

function cleanCallback(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d+ -]/g, '').trim().slice(0, 20);
  return cleaned || null;
}

/** The /help page: works from any phone with the user's number + PIN. */
export async function helpFromAnyPhone(
  deps: Deps,
  input: { phone: string; pin: string; action: HelpAction; callbackNumber: string | null },
): Promise<{ status: 'done'; sent: number } | { status: 'wrong' | 'locked' }> {
  const phone = normalizePkPhone(input.phone);
  const profile = phone ? await deps.repo.getProfileByPhone(phone) : null;
  if (!profile) return { status: 'wrong' };

  const guard = await verifyPin(deps, profile, input.pin);
  if (guard.result === 'wrong' || guard.result === 'locked') return { status: guard.result };
  if (guard.result === 'duress') return { status: 'done', sent: guard.sent ?? 0 };

  const open = await deps.repo.getOpenTrip(profile.id);
  if (input.action === 'help') {
    if (open?.status === 'active') await deps.repo.transitionTrip(open.id, 'active', 'alerted');
    const { sent } = await raiseAlert(deps, { userId: profile.id, tripId: open?.id ?? null, reason: 'help_page' });
    return { status: 'done', sent };
  }

  if (open) await deps.repo.transitionTrip(open.id, open.status, 'safe', { shareExpiresAt: shareExpiry(deps.now()) });
  const alert = await deps.repo.latestOpenAlert(profile.id);
  if (alert) await deps.repo.resolveAlert(alert.id, profile.name, deps.now());
  const sent = await notifyContacts(deps, profile.id, phoneLostText(profile.name, cleanCallback(input.callbackNumber)));
  return { status: 'done', sent };
}
