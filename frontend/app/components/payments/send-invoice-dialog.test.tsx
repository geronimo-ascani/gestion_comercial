import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SendInvoiceDialog } from "./send-invoice-dialog";
import type { Invoice } from "./payments-types";

const enviarComprobante = vi.fn();

vi.mock("./payments-api", () => ({
  enviarComprobante: (...args: unknown[]) => enviarComprobante(...args),
}));

const invoice: Invoice = {
  id: "CPB-0001",
  number: "0001-00000001",
  type: "A",
  orderNumber: "PV-0001",
  clientId: "CLI-0001",
  client: "Ana Pérez",
  clientEmail: "ana@example.com",
  date: "2026-11-19",
  amount: 100,
  paidAmount: 40,
  balance: 60,
  method: "MPG-0001",
  status: "aprobada",
};

function renderDialog(onSent = vi.fn(), onOpenChange = vi.fn()) {
  render(
    <SendInvoiceDialog
      open
      onOpenChange={onOpenChange}
      invoice={invoice}
      onSent={onSent}
    />,
  );
  return { onSent, onOpenChange };
}

describe("SendInvoiceDialog", () => {
  beforeEach(() => {
    enviarComprobante.mockReset();
    enviarComprobante.mockResolvedValue({
      id_envio: 1,
      destinatario: "ana@example.com",
      cc: [],
      bcc: [],
      estado: "enviado",
      origen: "manual",
      error: null,
      enviado_en: "2026-11-19T12:00:00",
    });
  });

  it("precarga el correo del cliente", () => {
    renderDialog();

    expect(screen.getByLabelText("Destinatario")).toHaveValue(
      "ana@example.com",
    );
  });

  it("envía con destinatario, CC y BCC", async () => {
    const { onSent, onOpenChange } = renderDialog();

    fireEvent.change(screen.getByLabelText("Destinatario"), {
      target: { value: "otro@example.com" },
    });
    fireEvent.change(screen.getByLabelText("CC (opcional)"), {
      target: { value: "cc1@example.com; cc2@example.com" },
    });
    fireEvent.change(screen.getByLabelText("BCC (opcional)"), {
      target: { value: "bcc@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante" }));

    await waitFor(() => {
      expect(enviarComprobante).toHaveBeenCalledWith("CPB-0001", {
        destinatario: "otro@example.com",
        cc: ["cc1@example.com", "cc2@example.com"],
        bcc: ["bcc@example.com"],
      });
    });
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("rechaza un destinatario inválido sin llamar a la API", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Destinatario"), {
      target: { value: "correo-invalido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante" }));

    expect(
      await screen.findByText("El destinatario no es un correo electrónico válido."),
    ).toBeInTheDocument();
    expect(enviarComprobante).not.toHaveBeenCalled();
  });

  it("rechaza un destinatario vacío", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("Destinatario"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante" }));

    expect(
      await screen.findByText("Indicá un destinatario."),
    ).toBeInTheDocument();
    expect(enviarComprobante).not.toHaveBeenCalled();
  });

  it("rechaza más de cinco copias", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("CC (opcional)"), {
      target: {
        value: Array.from({ length: 6 }, (_, index) => `cc${index}@example.com`).join(
          ", ",
        ),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante" }));

    expect(
      await screen.findByText("Podés agregar hasta 5 copias (CC)."),
    ).toBeInTheDocument();
    expect(enviarComprobante).not.toHaveBeenCalled();
  });

  it("rechaza direcciones repetidas", async () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText("CC (opcional)"), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comprobante" }));

    expect(
      await screen.findByText(
        "Hay direcciones repetidas entre destinatario, CC y BCC.",
      ),
    ).toBeInTheDocument();
    expect(enviarComprobante).not.toHaveBeenCalled();
  });
});
