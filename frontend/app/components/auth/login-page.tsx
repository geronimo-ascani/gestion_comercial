import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";

import { requireText, validateEmail } from "~/lib/validation";
import { loginUser, useCurrentUser } from "./session-store";
import { AuthSplitLayout } from "./auth-split-layout";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const navigate = useNavigate();
  const currentUser = useCurrentUser();

  if (currentUser) return <Navigate to="/dashboard" replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clientErrors: Record<string, string | null> = {
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      password: requireText(password, "Contraseña"),
    };
    setErrors(clientErrors);
    if (Object.values(clientErrors).some((error) => error)) return;

    const result = loginUser(email, password);
    if (result) {
      setErrors({ password: result });
      return;
    }
    navigate("/dashboard");
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
        <Button className="w-full" size="lg" type="submit">
          Iniciar sesión
        </Button>
      </form>
    </AuthSplitLayout>
  );
}