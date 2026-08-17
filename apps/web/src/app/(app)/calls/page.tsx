import { Phone } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function CallsPage() {
  return (
    <ComingSoon
      icon={Phone}
      title="Calls are on the way"
      description="Audio and video calling — coming soon. Your call history will show up here."
    />
  );
}
