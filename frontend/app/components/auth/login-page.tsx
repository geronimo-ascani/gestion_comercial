import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { LogIn } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { FieldError } from "~/components/ui/field-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

import { requireText, validateEmail } from "~/lib/validation";
import { loginUser } from "./session-store";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const navigate = useNavigate();

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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white">
            <LogIn className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
          <CardDescription>
            Ingrese sus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <form noValidate onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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
                  ¿Olvidó su contraseña?
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
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full" size="lg" type="submit">
              Iniciar sesión
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿No tiene una cuenta?{" "}
              <Link to="/register" className="text-foreground hover:underline">
                Regístrese
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}