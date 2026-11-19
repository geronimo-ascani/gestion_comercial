import { describe, expect, it, vi } from "vitest";

vi.mock("./payments-api", () => ({
  listMediosPago: vi.fn().mockResolvedValue([
    {
      id_medio_pago: "MPG-0001",
      medio_pago: "Efectivo",
      tipo_cobro: "contado",
    },
  ]),
  crearMedioPago: vi.fn().mockResolvedValue({
    id_medio_pago: "MPG-0002",
    medio_pago: "Transferencia",
    tipo_cobro: "transferencia",
  }),
}));

import {
  addPaymentMethod,
  getPaymentMethod,
  getPaymentMethodLabel,
  getPaymentMethodsSnapshot,
  isPaymentMethodLabelTaken,
  loadPaymentMethods,
} from "./payment-methods-store";

describe("payment-methods-store", () => {
  it("loads methods from the API", async () => {
    await loadPaymentMethods(true);
    const methods = getPaymentMethodsSnapshot();
    expect(methods).toHaveLength(1);
    expect(getPaymentMethod("MPG-0001")?.label).toBe("Efectivo");
    expect(getPaymentMethod("MPG-0001")?.tipoCobro).toBe("contado");
  });

  it("adds a new method through the API", async () => {
    const created = await addPaymentMethod({
      label: "Transferencia",
      tipoCobro: "transferencia",
    });
    expect(created.id).toBe("MPG-0002");
    expect(getPaymentMethodLabel(created.id)).toBe("Transferencia");
    expect(isPaymentMethodLabelTaken("Transferencia")).toBe(true);
    expect(isPaymentMethodLabelTaken("transferencia")).toBe(true);
  });

  it("handles unknown method", () => {
    expect(getPaymentMethod("no-existe")).toBeUndefined();
    expect(getPaymentMethodLabel("no-existe")).toBe("no-existe");
  });
});
