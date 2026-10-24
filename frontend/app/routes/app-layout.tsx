import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "~/components/layout/app-layout";
import { useCurrentUser } from "~/components/auth/session-store";

export default function AppLayoutRoute() {
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !currentUser) navigate("/login", { replace: true });
  }, [currentUser, hydrated, navigate]);

  if (!hydrated || !currentUser) return null;

  return <AppLayout />;
}