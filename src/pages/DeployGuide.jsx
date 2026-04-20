import PageHeader from "@/components/shared/PageHeader";
import IntegrationDeployGuide from "@/components/deploy/IntegrationDeployGuide";
import { useAuth } from "@/lib/AuthContext";
import { Shield } from "lucide-react";

export default function DeployGuide() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="p-4 rounded-full bg-red-50 border border-red-200">
          <Shield className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Super Admin Only</h2>
        <p className="text-muted-foreground max-w-sm">The Deploy Guide is restricted to Super Admins. Contact your administrator for access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Integration & Deploy Guide" description="Super Admin — Full Debian 12: Asterisk 20 + Kannel SMPP/HTTP + SIM Box + MariaDB per-tenant CDR + real-time billing + firewall" />
      <IntegrationDeployGuide />
    </div>
  );
}