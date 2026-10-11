import { Navigate } from "react-router";

import { AppLayout } from "~/components/layout/app-layout";
import { useCurrentUser } from "~/components/auth/session-store";

export default function AppLayoutRoute() {
  const currentUser = useCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}