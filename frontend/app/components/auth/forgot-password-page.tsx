import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { MailCheck } from "lucide-react";

import { Button } from "~/components/ui/button";
import { FieldError } from "~/components/ui/field-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { requireText, validateEmail } from "~/lib/validation";
import { solicitarRecuperacion } from "./auth-api";
import { AuthSplitLayout } from "./auth-split-layout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = email.trim()
      ? validateEmail(email)
      : requireText(email, "Correo electrónico");
    setErrors({ email: emailError });
    if (emailError) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await solicitarRecuperacion(email.trim());
      setSent(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el correo de recuperación."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      title="Recuperar contraseña"
      subtitle="Ingresá tu correo electrónico y te enviaremos un enlace para restablecerla."
      footer={
        <p className="text-center text-sm text-muted-foreground">
          ¿Recordaste tu contraseña?{" "}
          <Link
            to="/login"
            className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
          >
            Iniciar sesión
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 px-4 py-8 text-center">
          <MailCheck className="h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Si el correo existe, recibirás un enlace para restablecer tu
            contraseña. Revisá tu bandeja de entrada.
          </p>
        </div>
      ) : (
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
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
          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}
    </AuthSplitLayout>
  );
}