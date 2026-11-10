import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { restablecerContrasena } from "./auth-api";
import { AuthSplitLayout } from "./auth-split-layout";
import { logoutUser } from "./session-store";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setFieldError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setFieldError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      setSubmitError("El enlace no es válido o expiró.");
      return;
    }

    setFieldError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      await restablecerContrasena(token, password);
      logoutUser();
      navigate("/login", { replace: true });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo cambiar la contraseña."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      title="Nueva contraseña"
      subtitle="Elegí una contraseña nueva para tu cuenta."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Volver al inicio de sesión
          </Link>
        </p>
      }
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="reset-password">Nueva contraseña</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldError(null);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-password-confirmation">
            Confirmar contraseña
          </Label>
          <Input
            id="reset-password-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setFieldError(null);
            }}
          />
          <FieldError message={fieldError} />
        </div>
        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}
        <Button className="w-full" size="lg" type="submit" disabled={submitting}>
          {submitting ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </AuthSplitLayout>
  );
}
