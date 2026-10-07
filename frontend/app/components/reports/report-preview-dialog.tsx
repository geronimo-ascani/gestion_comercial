import { useRef, useState, type ReactNode } from "react";
import { DownloadIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "~/components/ui/dialog";
import { exportReportAsPdf } from "~/lib/export-report";

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function ReportPreviewDialog({
  open,
  onOpenChange,
  title,
  children,
}: ReportPreviewDialogProps) {
  const reportContentRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    if (!reportContentRef.current) return;
    setGenerating(true);
    try {
      await exportReportAsPdf(reportContentRef.current);
    } catch (error) {
      console.error("No se pudo exportar el reporte:", error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-fit min-w-[826px] max-w-[95vw] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl bg-slate-900 p-0"
      >
        <div className="flex items-center justify-between gap-4 bg-slate-900 px-6 py-3">
          <DialogTitle className="truncate text-sm font-semibold text-slate-200">
            {title}
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={generating}
              variant="outline"
              className="bg-white text-slate-900 hover:bg-slate-200 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <DownloadIcon className="size-4" />
              {generating ? "Generando PDF…" : "Descargar PDF"}
            </Button>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  className="bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                />
              }
            >
              Cancelar
            </DialogClose>
          </div>
        </div>
        <div
          ref={reportContentRef}
          className="max-h-[calc(100vh-3.5rem-1rem)] overflow-y-auto overflow-x-hidden"
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}