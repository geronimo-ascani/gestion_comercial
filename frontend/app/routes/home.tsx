import { useEffect } from "react";
import { Navigate } from "react-router";

import {
  initializeSession,
  useCurrentUser,
  useSessionInitialized,
} from "~/components/auth/session-store";
import { defaultRouteForRole } from "~/lib/permissions";

export default function HomePage() {
  const currentUser = useCurrentUser();
  const sessionInitialized = useSessionInitialized();

  useEffect(() => {
    void initializeSession().catch(() => {});
  }, []);

  if (!sessionInitialized) return null;

  return (
    <Navigate
      to={currentUser ? defaultRouteForRole(currentUser.role) : "/login"}
      replace
    />
  );
}
