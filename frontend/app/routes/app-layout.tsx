import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { AppLayout } from "~/components/layout/app-layout";
import {
  initializeSession,
  useCurrentUser,
} from "~/components/auth/session-store";
import { Button } from "~/components/ui/button";

export default function AppLayoutRoute() {
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    void initializeSession()
      .then(() => setHydrated(true))
      .catch((error: unknown) => {
        setSessionError(
          error instanceof Error ? error.message : "No se pudo validar la sesión."
        );
        setHydrated(true);
      });
  }, []);

  useEffect(() => {
    if (hydrated && !currentUser && !sessionError) {
      navigate("/login", { replace: true });
    }
  }, [currentUser, hydrated, navigate, sessionError]);

  if (!hydrated) return null;
  if (sessionError) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8">
        <p role="alert" className="text-sm text-destructive">
          {sessionError}
        </p>
        <Button onClick={() => navigate("/login", { replace: true })}>
          Ir al inicio de sesión
        </Button>
      </main>
    );
  }
  if (!currentUser) return null;

  return <AppLayout />;
}