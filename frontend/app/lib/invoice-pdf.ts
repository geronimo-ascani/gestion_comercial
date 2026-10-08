import type { SalesOrder } from "~/components/sales/sales-types";
import { appConfig } from "~/config/app";
import type { Invoice, InvoiceStatus } from "~/components/payments/payments-types";

const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  emitida: "Emitida",
  aprobada: "Aprobada",
  pagada: "Pagada",
  rechazada: "Rechazada",
};

export async function exportInvoiceAsPdf(order: SalesOrder, invoice: Invoice) {
  const { jsPDF } = await import("jspdf");

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(appConfig.title, margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text("Comprobante de venta", margin, (y += 18));

  pdf.setFontSize(10);
  pdf.text(`Comprobante N° ${invoice.number}`, pageWidth - margin, margin, {
    align: "right",
  });
  pdf.text(`Fecha: ${invoice.date}`, pageWidth - margin, margin + 14, {
    align: "right",
  });
  pdf.text(
    `Venta: ${order.number}`,
    pageWidth - margin,
    margin + 28,
    { align: "right" }
  );

  y += 30;
  pdf.setDrawColor(200);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 20;

  pdf.setFont("helvetica", "bold");
  pdf.text("Cliente", margin, y);
  pdf.setFont("helvetica", "normal");
  y += 14;
  pdf.text(order.client || "Sin definir", margin, y);
  if (order.email) {
    y += 14;
    pdf.text(`Email: ${order.email}`, margin, y);
  }
  if (order.phone) {
    y += 14;
    pdf.text(`Teléfono: ${order.phone}`, margin, y);
  }
  y += 22;

  const columns = { product: margin, qty: 300, unit: 380, subtotal: pageWidth - margin };
  pdf.setFont("helvetica", "bold");
  pdf.text("Producto", columns.product, y);
  pdf.text("Cant.", columns.qty, y, { align: "right" });
  pdf.text("P. unit.", columns.unit, y, { align: "right" });
  pdf.text("Subtotal", columns.subtotal, y, { align: "right" });
  y += 8;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 14;
  pdf.setFont("helvetica", "normal");

  for (const item of order.items) {
    const wrapped = pdf.splitTextToSize(item.product, columns.qty - margin - 12);
    pdf.text(wrapped, columns.product, y);
    pdf.text(String(item.qty), columns.qty, y, { align: "right" });
    pdf.text(item.unitPrice, columns.unit, y, { align: "right" });
    pdf.text(item.subtotal, columns.subtotal, y, { align: "right" });
    y += Math.max(wrapped.length * 13, 16);
    if (y > pdf.internal.pageSize.getHeight() - 120) {
      pdf.addPage();
      y = margin;
    }
  }

  y += 6;
  pdf.line(margin, y, pageWidth - margin, y);
  y += 20;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Total", columns.qty, y, { align: "right" });
  pdf.text(order.total, columns.subtotal, y, { align: "right" });

  y += 30;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Estado: ${invoiceStatusLabels[invoice.status]}`, margin, y);
  if (invoice.sentAt) {
    y += 14;
    const reenvios = (invoice.sendCount ?? 1) - 1;
    pdf.text(
      `Enviado por email el ${invoice.sentAt}${
        reenvios > 0 ? ` · reenviado ${reenvios} vez/veces` : ""
      }`,
      margin,
      y
    );
  }

  pdf.save(`factura-${invoice.number}.pdf`);
}