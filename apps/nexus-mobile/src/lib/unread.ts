import { nexusApi } from './nexusApi';
import type { ConversationsPage, NotificationsPage } from './socialTypes';

/**
 * The number the bottom bar prints over the inbox mark.
 *
 * The web keeps two counters and prints their sum (`unreadMessageCount + unreadActivityCount`, app.js:2067).
 * The first is the unread rows of the unified inbox (`GET /api/chat/conversations?persona=all&box=inbox`,
 * app.js:2416-2433), the second is the unread notifications that are not messages
 * (`GET /api/notifications?persona=all`, app.js:2435-2454). Both counters are capped at 9999, so a server
 * that reported more could never make the bar print a number it was not built to hold.
 *
 * It answers `null` when either read fails, and the caller keeps the number it already had: the web keeps
 * its last count on a failed read too, and an Android shell that answered 0 would be claiming an inbox it
 * never saw.
 */
const UNREAD_CAP = 9999;

/** A counter the server sent, or 0 when it sent something that is not one of its own counters. */
function counter(value: unknown): number {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= UNREAD_CAP ? number : 0;
}

export async function readUnreadTotal(): Promise<number | null> {
  const [inbox, notifications] = await Promise.all([
    nexusApi<ConversationsPage>('/api/chat/conversations?persona=all&box=inbox').catch(() => null),
    nexusApi<NotificationsPage>('/api/notifications?persona=all').catch(() => null),
  ]);
  const conversations = inbox?.conversations;
  // The web accepts at most 100 rows and refuses to count an envelope it cannot vouch for (app.js:2423-2430).
  if (!inbox || !notifications || !Array.isArray(conversations) || conversations.length > 100) return null;
  const messages = Math.min(UNREAD_CAP, conversations.reduce((total, row) => total + counter(row?.unread), 0));
  return Math.min(UNREAD_CAP, messages + counter(notifications.unread_non_message));
}
