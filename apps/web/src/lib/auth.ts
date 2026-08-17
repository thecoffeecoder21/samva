import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, users, profiles } from "@samva/db";

export async function requireAuthId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

/** Ensures a `users` row exists for the signed-in Clerk identity; does not create a profile. */
export async function getOrCreateUser() {
  const { userId: authId } = await auth();
  if (!authId) return null;

  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(users.authId, authId) });
  if (existing) return existing;

  const clerkUser = await currentUser();
  const [created] = await db
    .insert(users)
    .values({
      authId,
      email: clerkUser?.primaryEmailAddress?.emailAddress ?? null,
      phone: clerkUser?.primaryPhoneNumber?.phoneNumber ?? null,
    })
    .returning();
  return created;
}

export async function getCurrentProfile(): Promise<typeof profiles.$inferSelect | null> {
  const user = await getOrCreateUser();
  if (!user) return null;
  const db = getDb();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
  return profile ?? null;
}
