import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { getChannelDirectory } from "@/lib/queries";
import { DiscoverView } from "@/components/chat/DiscoverView";

export default async function DiscoverPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  const channels = await getChannelDirectory(user.id);
  return <DiscoverView initialChannels={channels} />;
}
