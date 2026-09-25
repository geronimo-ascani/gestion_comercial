import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { KeyRound, MailCheck } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FieldError } from "~/components/ui/field-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { requireText, validateEmail } from "~/lib/validation";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = email.trim()
      ? validateEmail(email)
      : requireText(email, "Correo electrónico");
    setErrors({ email: emailError });
    if (emailError) return;
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md [--card-spacing:--spacing(6)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-blue-600 text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            Ingrese su correo electrónico y le enviaremos un enlace para
            restablecerla
          </CardDescription>
        </CardHeader>

        {sent ? (
          <CardContent className="mt-3">
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 px-4 py-8 text-center">
              <MailCheck className="h-9 w-9 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Si el correo existe, recibirá un enlace para restablecer su
                contraseña. Revise su bandeja de entrada.
              </p>
            </div>
            <Link
              to="/login"
              className="mt-4 block text-center text-sm text-foreground hover:underline"
            >
              Volver a iniciar sesión
            </Link>
          </CardContent>
        ) : (
          <form noValidate onSubmit={handleSubmit}>
            <CardContent className="mt-3 space-y-6 pb-8">
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
            </CardContent>
            <CardFooter className="flex-col space-y-5 pt-7">
              <Button className="w-full" size="lg" type="submit">
                Enviar enlace
              </Button>
              <p className="text-sm text-muted-foreground">
                ¿Recordó su contraseña?{" "}
                <Link to="/login" className="text-foreground hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}