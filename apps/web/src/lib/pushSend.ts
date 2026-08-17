import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { conversationMembers, getDb, pushSubscriptions } from "@samva/db";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

/**
 * Sends a push notification to every *other* member of a conversation.
 * Simplified per section 55's spirit (no OS-notification spam) but not the
 * full smart-grouping design: it always notifies, regardless of whether the
 * recipient currently has the conversation open in another tab — tracking
 * that reliably would need a distributed presence signal this MVP doesn't
 * have yet.
 */
export async function notifyOtherMembers(
  conversationId: string,
  senderId: string,
  title: string,
  body: string,
) {
  ensureConfigured();
  if (!configured) return;

  const db = getDb();
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));

  const recipientIds = members.map((m) => m.userId).filter((id) => id !== senderId);
  if (recipientIds.length === 0) return;

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, recipientIds));

  const payload = JSON.stringify({ title, body, conversationId });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    }),
  );
}
