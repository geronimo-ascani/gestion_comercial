export async function exportReportAsPdf(container: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const sheets = Array.from(
    container.querySelectorAll<HTMLElement>(".sheet")
  );
  if (sheets.length === 0) {
    throw new Error("No se encontraron hojas del reporte para exportar.");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  for (let i = 0; i < sheets.length; i++) {
    const canvas = await html2canvas(sheets[i], {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const image = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) {
      pdf.addPage("a4", "portrait");
    }
    pdf.addImage(image, "JPEG", 0, 0, 595.28, 841.89);
  }

  pdf.save("reporte-ejecutivo-gestion.pdf");
}