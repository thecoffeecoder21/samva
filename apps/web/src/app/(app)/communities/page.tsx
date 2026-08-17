import { redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { getMyChannels } from "@/lib/queries";
import { CommunitiesView } from "@/components/chat/CommunitiesView";

export default async function CommunitiesPage() {
  const user = await getOrCreateUser();
  if (!user) redirect("/sign-in");

  const channels = await getMyChannels(user.id);
  return <CommunitiesView channels={channels} />;
}
