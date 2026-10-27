import { describe, expect, it } from "vitest";
import {
  addPaymentMethod,
  getPaymentMethod,
  getPaymentMethodLabel,
  getPaymentMethodsSnapshot,
  isGatewayPaymentMethod,
  isPaymentMethodLabelTaken,
} from "./payment-methods-store";

describe("payment-methods-store", () => {
  it("has default methods", () => {
    const methods = getPaymentMethodsSnapshot();
    expect(methods.length).toBeGreaterThanOrEqual(3);
    expect(getPaymentMethod("efectivo")?.label).toBe("Efectivo");
    expect(isGatewayPaymentMethod("tarjeta")).toBe(true);
    expect(isGatewayPaymentMethod("efectivo")).toBe(false);
  });

  it("adds a new method", () => {
    const created = addPaymentMethod({ label: "Transferencia", gateway: false });
    expect(created.id).toBeTruthy();
    expect(getPaymentMethodLabel(created.id)).toBe("Transferencia");
    expect(isPaymentMethodLabelTaken("Transferencia")).toBe(true);
    expect(isPaymentMethodLabelTaken("transferencia")).toBe(true);
  });

  it("handles unknown method", () => {
    expect(getPaymentMethod("no-existe")).toBeUndefined();
    expect(getPaymentMethodLabel("no-existe")).toBe("no-existe");
    expect(isGatewayPaymentMethod("no-existe")).toBe(false);
  });
});
