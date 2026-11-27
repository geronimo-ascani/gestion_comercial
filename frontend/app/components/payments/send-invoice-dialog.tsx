import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  esEmailValido,
  normalizarEmail,
  parsearListaEmails,
} from "~/lib/email";

import { enviarComprobante, type EnvioApi } from "./payments-api";
import type { Invoice } from "./payments-types";

const MAX_COPIAS = 5;

interface SendInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onSent?: (envio: EnvioApi) => void;
}

interface DestinatariosValidos {
  destinatario: string;
  cc: string[];
  bcc: string[];
}

function validarDestinatarios(
  destinatario: string,
  cc: string,
  bcc: string,
): DestinatariosValidos | string {
  const destino = normalizarEmail(destinatario);
  if (!destino) return "Indicá un destinatario.";
  if (!esEmailValido(destino)) {
    return "El destinatario no es un correo electrónico válido.";
  }

  const copias = parsearListaEmails(cc);
  const ocultas = parsearListaEmails(bcc);
  if (copias.length > MAX_COPIAS) {
    return `Podés agregar hasta ${MAX_COPIAS} copias (CC).`;
  }
  if (ocultas.length > MAX_COPIAS) {
    return `Podés agregar hasta ${MAX_COPIAS} copias ocultas (BCC).`;
  }

  const invalida = [...copias, ...ocultas].find(
    (correo) => !esEmailValido(correo),
  );
  if (invalida) {
    return `La dirección ${invalida} no es un correo electrónico válido.`;
  }

  const todas = [destino, ...copias, ...ocultas];
  if (new Set(todas).size !== todas.length) {
    return "Hay direcciones repetidas entre destinatario, CC y BCC.";
  }

  return { destinatario: destino, cc: copias, bcc: ocultas };
}

export function SendInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onSent,
}: SendInvoiceDialogProps) {
  const [destinatario, setDestinatario] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setDestinatario(invoice.clientEmail ?? "");
    setCc("");
    setBcc("");
    setError(null);
    setSubmitting(false);
    submittingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  async function handleConfirm() {
    if (!invoice || submittingRef.current) return;

    const validados = validarDestinatarios(destinatario, cc, bcc);
    if (typeof validados === "string") {
      setError(validados);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const envio = await enviarComprobante(invoice.id, validados);
      onSent?.(envio);
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo enviar el comprobante.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar comprobante por email</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Comprobante ${invoice.number} · ${invoice.client}`
              : "Seleccione un comprobante."}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-invoice-to">Destinatario</Label>
              <Input
                id="send-invoice-to"
                type="email"
                value={destinatario}
                disabled={submitting}
                onChange={(event) => {
                  setDestinatario(event.target.value);
                  setError(null);
                }}
                placeholder="cliente@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="send-invoice-cc">CC (opcional)</Label>
              <Input
                id="send-invoice-cc"
                value={cc}
                disabled={submitting}
                onChange={(event) => {
                  setCc(event.target.value);
                  setError(null);
                }}
                placeholder="copia1@ejemplo.com, copia2@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="send-invoice-bcc">BCC (opcional)</Label>
              <Input
                id="send-invoice-bcc"
                value={bcc}
                disabled={submitting}
                onChange={(event) => {
                  setBcc(event.target.value);
                  setError(null);
                }}
                placeholder="copia-oculta@ejemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                Separá varias direcciones con coma o punto y coma. Hasta{" "}
                {MAX_COPIAS} copias por campo. Se adjunta el PDF del comprobante
                y el envío se procesa en segundo plano.
              </p>
            </div>

            {error && (
              <p
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={submitting} />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={() => void handleConfirm()}
            disabled={submitting || !invoice}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Enviar comprobante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
