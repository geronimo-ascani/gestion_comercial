import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";

import { requireText, validateEmail } from "~/lib/validation";
import {
  initializeSession,
  loginUser,
  useCurrentUser,
  useSessionInitialized,
} from "./session-store";
import { AuthSplitLayout } from "./auth-split-layout";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const sessionInitialized = useSessionInitialized();

  useEffect(() => {
    void initializeSession().catch((error: unknown) => {
      setSessionError(
        error instanceof Error ? error.message : "No se pudo validar la sesión."
      );
    });
  }, []);

  if (currentUser) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clientErrors: Record<string, string | null> = {
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      password: requireText(password, "Contraseña"),
    };
    setErrors(clientErrors);
    if (Object.values(clientErrors).some((error) => error)) return;

    setSubmitting(true);
    try {
      await loginUser(email, password);
      navigate("/dashboard");
    } catch (error) {
      setErrors({
        password:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar sesión.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      title="Iniciar sesión"
      subtitle="Ingresá tus credenciales para acceder al sistema."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          ¿No tenés una cuenta?{" "}
          <Link
            to="/register"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Regístrate
          </Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        {sessionError && (
          <p role="status" className="text-sm text-destructive">
            {sessionError}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            placeholder="usuario@correo.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((prev) => ({ ...prev, email: null }));
            }}
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((prev) => ({ ...prev, password: null }));
            }}
            aria-invalid={!!errors.password}
          />
          <FieldError message={errors.password} />
        </div>
        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={submitting || !sessionInitialized}
        >
          {submitting ? "Ingresando…" : "Iniciar sesión"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}