"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, profiles } from "@samva/db";
import { getOrCreateUser } from "@/lib/auth";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export interface OnboardingState {
  error: string | null;
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();

  if (displayName.length < 1 || displayName.length > 60) {
    return { error: "Enter a display name between 1 and 60 characters." };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Usernames are 3–20 characters: lowercase letters, numbers, underscores." };
  }

  const user = await getOrCreateUser();
  if (!user) {
    return { error: "You need to sign in first." };
  }

  const db = getDb();
  const usernameTaken = await db.query.profiles.findFirst({ where: eq(profiles.username, username) });
  if (usernameTaken && usernameTaken.userId !== user.id) {
    return { error: `@${username} is already taken.` };
  }

  const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
  if (existing) {
    await db
      .update(profiles)
      .set({ displayName, username, updatedAt: new Date() })
      .where(eq(profiles.userId, user.id));
  } else {
    await db.insert(profiles).values({ userId: user.id, displayName, username });
  }

  redirect("/chats");
}
