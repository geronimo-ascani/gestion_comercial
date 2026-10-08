import type { PaymentMethod } from "./payments-types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function simulateGatewayPayment(
  method: PaymentMethod
): Promise<{ status: "aprobado" | "rechazado"; reference: string }> {
  await wait(700 + Math.random() * 400);
  const approved = Math.random() < 0.85;
  const prefix = method === "mercadopago" ? "MP" : "TC";
  return {
    status: approved ? "aprobado" : "rechazado",
    reference: `${prefix}-${new Date().getFullYear()}-${Math.floor(
      Math.random() * 90000 + 10000
    )}`,
  };
}