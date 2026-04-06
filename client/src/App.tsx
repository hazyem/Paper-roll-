import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import ReceiveOrder from "@/pages/ReceiveOrder";
import ReleaseMaterial from "@/pages/ReleaseMaterial";
import AmendDetails from "@/pages/AmendDetails";
import Reports from "@/pages/Reports";
import UserManagement from "@/pages/UserManagement";
import AuthPage from "@/pages/auth-page";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { AdminRoute } from "@/lib/admin-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <ProtectedRoute path="/" component={() => (
        <Layout>
          <Dashboard />
        </Layout>
      )} />
      
      <ProtectedRoute path="/receive" component={() => (
        <Layout>
          <ReceiveOrder />
        </Layout>
      )} />
      
      <ProtectedRoute path="/release" component={() => (
        <Layout>
          <ReleaseMaterial />
        </Layout>
      )} />
      
      <ProtectedRoute path="/amend" component={() => (
        <Layout>
          <AmendDetails />
        </Layout>
      )} />
      
      <ProtectedRoute path="/reports" component={() => (
        <Layout>
          <Reports />
        </Layout>
      )} />
      
      <AdminRoute path="/users" component={UserManagement} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <Router />
          <Toaster />
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
