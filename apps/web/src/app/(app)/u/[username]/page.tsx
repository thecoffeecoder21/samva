import { notFound, redirect } from "next/navigation";
import { getOrCreateUser } from "@/lib/auth";
import { getPublicProfileByUsername } from "@/lib/queries";
import { isBlocked } from "@/lib/blocks";
import { PublicProfileView } from "./PublicProfileView";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getOrCreateUser();
  if (!viewer) redirect("/sign-in");

  const profile = await getPublicProfileByUsername(username);
  if (!profile) notFound();
  if (profile.userId === viewer.id) redirect("/profile");

  const blocked = await isBlocked(viewer.id, profile.userId);

  return <PublicProfileView profile={profile} canMessage={!blocked} />;
}
