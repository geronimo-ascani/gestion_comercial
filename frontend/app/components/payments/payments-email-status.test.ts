import { describe, expect, it } from "vitest";

import { envioEnCurso, textoBotonEnvio } from "./payments-api";
import type { Invoice } from "./payments-types";

function invoice(emailStatus: Invoice["emailStatus"]): Invoice {
  return {
    id: "CPB-0001",
    number: "0001-00000001",
    type: "B",
    orderNumber: "PV-0001",
    clientId: "CLI-0001",
    client: "Ana Pérez",
    clientEmail: "ana@example.com",
    date: "10/11/2026",
    amount: 100,
    paidAmount: 0,
    balance: 100,
    method: "",
    status: "emitida",
    emailStatus,
  };
}

describe("estado de envío de comprobantes", () => {
  it("muestra programado y bloquea reenvíos mientras está pendiente", () => {
    const pendiente = invoice("pendiente");

    expect(textoBotonEnvio(pendiente)).toBe("Programado");
    expect(envioEnCurso(pendiente)).toBe(true);
  });

  it("muestra enviado y bloquea un nuevo envío", () => {
    const enviado = invoice("enviado");

    expect(textoBotonEnvio(enviado, "Enviar por email")).toBe("Enviado");
    expect(envioEnCurso(enviado)).toBe(true);
  });

  it("permite reenviar después de un fallo", () => {
    const fallido = invoice("fallido");

    expect(textoBotonEnvio(fallido)).toBe("Reenviar");
    expect(envioEnCurso(fallido)).toBe(false);
  });

  it("usa la etiqueta por defecto cuando nunca se envió", () => {
    expect(textoBotonEnvio(invoice(null), "Enviar por email")).toBe(
      "Enviar por email",
    );
    expect(envioEnCurso(invoice(undefined))).toBe(false);
  });
});
