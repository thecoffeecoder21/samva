import { notFound } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { getConversationHeader, getMemberNames } from "@/lib/queries";
import { listMessages } from "@/lib/messages";
import { ChatWindow } from "@/components/chat/ChatWindow";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const user = await getOrCreateUser();
  if (!user) notFound();

  const header = await getConversationHeader(conversationId, user.id);
  if (!header) notFound();

  const [{ messages }, memberNames] = await Promise.all([
    listMessages(conversationId, {}, user.id),
    getMemberNames(conversationId),
  ]);

  return (
    <ChatWindow
      conversationId={conversationId}
      currentUserId={user.id}
      title={header.title}
      avatarUrl={header.avatarUrl}
      peerUserId={header.peerUserId}
      initialIsOnline={header.isOnline}
      initialLastSeenAt={header.lastSeenAt}
      initialPinnedMessageId={header.pinnedMessageId}
      initialDidIBlockPeer={header.didIBlockPeer}
      initialConversationBlocked={header.conversationBlocked}
      initialDisappearingSeconds={header.disappearingSeconds}
      initialMessages={messages}
      memberNames={memberNames}
    />
  );
}
