import { MessageCircle } from "lucide-react";
import { EmptyState } from "@samva/ui";

export default function ChatsIndexPage() {
  return (
    <EmptyState
      icon={<MessageCircle size={40} strokeWidth={1.25} />}
      title="Select a conversation"
      description="Pick a chat from the list, or start a new one."
      className="h-full"
    />
  );
}
