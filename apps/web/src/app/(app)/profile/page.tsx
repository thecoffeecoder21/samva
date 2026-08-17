import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return <ProfileView profile={profile} />;
}
