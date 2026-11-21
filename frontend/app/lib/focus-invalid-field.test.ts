import { afterEach, describe, expect, it, vi } from "vitest";

import { enfocarPrimerCampoInvalido } from "./focus-invalid-field";

const campos = [
  { key: "pedido", elementId: "invoice-pedido" },
  { key: "fechaEmision", elementId: "invoice-fecha-emision" },
  { key: "total", elementId: "invoice-total" },
  { key: "archivo", elementId: "invoice-archivo" },
] as const;

describe("enfocarPrimerCampoInvalido", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hace scroll y enfoca el primer campo con error", () => {
    document.body.innerHTML = `
      <button id="invoice-pedido"></button>
      <input id="invoice-fecha-emision" />
      <input id="invoice-total" />
      <input id="invoice-archivo" type="file" />
    `;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const enfocado = enfocarPrimerCampoInvalido(
      { pedido: null, fechaEmision: "Ingrese la fecha", total: "Ingrese el total" },
      campos
    );

    expect(enfocado).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(document.activeElement?.id).toBe("invoice-fecha-emision");
  });

  it("no hace nada cuando no hay errores", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const enfocado = enfocarPrimerCampoInvalido({ pedido: null }, campos);

    expect(enfocado).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
