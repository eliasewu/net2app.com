import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard.jsx';
import Monitoring from './pages/Monitoring';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import RoutesPage from './pages/Routes';
import Rates from './pages/Rates';
import MccMncPage from './pages/MccMnc';
import SmsLogs from './pages/SmsLogs';
import VoiceOtpPage from './pages/VoiceOtp';
import ContentTemplates from './pages/ContentTemplates';
import Reports from './pages/Reports';
import Invoices from './pages/Invoices';
import Notifications from './pages/Notifications';
import TestSms from './pages/TestSms.jsx';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import NumberTranslation from './pages/NumberTranslation';
import IpManagement from './pages/IpManagement';
import Campaigns from './pages/Campaigns';
import VoipPlatform from './pages/VoipPlatform';
import ServerNodes from './pages/ServerNodes';
import SmppGateway from './pages/SmppGateway';
import BillingInvoices from './pages/BillingInvoices';
import DeployGuide from './pages/DeployGuide';
import TenantManagement from './pages/TenantManagement';
import DeviceConnect from './pages/DeviceConnect';
import LandingPage from './pages/LandingPage';
import LandingAdmin from './pages/LandingAdmin';
import PricingPlans from './pages/PricingPlans';
import CustomerPortal from './pages/CustomerPortal';
import PortalManager from './pages/PortalManager';
import TenantDashboard from './pages/TenantDashboard';
import AlertRules from './pages/AlertRules';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm text-muted-foreground">Loading Net2app...</p>
        </div>
      </div>
    );
  }

  if (authError) {
      if (authError.type === 'user_not_registered') {
        return <UserNotRegisteredError />;
      } else if (authError.type === 'auth_required') {
        return <LandingPage />;
      }
    }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/rates" element={<Rates />} />
        <Route path="/mccmnc" element={<MccMncPage />} />
        <Route path="/sms-logs" element={<SmsLogs />} />
        <Route path="/voice-otp" element={<VoiceOtpPage />} />
        <Route path="/content" element={<ContentTemplates />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/test-sms" element={<TestSms />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/translation" element={<NumberTranslation />} />
        <Route path="/ip-management" element={<IpManagement />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/voip" element={<VoipPlatform />} />
        <Route path="/servers" element={<ServerNodes />} />
        <Route path="/smpp-gateway" element={<SmppGateway />} />
        <Route path="/billing" element={<BillingInvoices />} />
        <Route path="/deploy-guide" element={<DeployGuide />} />
        <Route path="/tenants" element={<TenantManagement />} />
        <Route path="/device-connect" element={<DeviceConnect />} />
        <Route path="/landing-admin" element={<LandingAdmin />} />
        <Route path="/pricing" element={<PricingPlans />} />
        <Route path="/portal-manager" element={<PortalManager />} />
        <Route path="/tenant-dashboard" element={<TenantDashboard />} />
        <Route path="/alert-rules" element={<AlertRules />} />
      </Route>
      <Route path="/portal" element={<CustomerPortal />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App