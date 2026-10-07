import type { ReactNode } from "react";

interface ReportPageProps {
  children: ReactNode;
  pageLabel: string;
}

export function ReportPage({ children, pageLabel }: ReportPageProps) {
  return (
    <div className="page-wrap py-4">
      <div className="sheet mx-auto flex h-[1123px] w-[794px] flex-col overflow-hidden bg-white p-8 text-slate-900 shadow-2xl">
        {children}
        <footer className="mt-auto flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-400">
          <span>Reporte Ejecutivo de Gestión · Datos de demostración</span>
          <span>{pageLabel}</span>
        </footer>
      </div>
    </div>
  );
}