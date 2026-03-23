import { AuthGate } from "@/components/auth/AuthGate";
import VigilDashboard from "@/components/VigilDashboard";

export default function Home() {
  return (
    <AuthGate>
      <VigilDashboard />
    </AuthGate>
  );
}
