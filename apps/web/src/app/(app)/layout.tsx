import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getCurrentProfile, getOrCreateUser } from "@/lib/auth";
import { getConversationFolders, getConversationSummaries } from "@/lib/queries";
import { ChatShell } from "@/components/chat/ChatShell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const user = await getOrCreateUser();
  const [conversations, folders] = user
    ? await Promise.all([getConversationSummaries(user.id), getConversationFolders(user.id)])
    : [[], []];

  return (
    <ChatShell conversations={conversations} folders={folders} currentUserId={user!.id}>
      {children}
    </ChatShell>
  );
}
