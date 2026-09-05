import { Outlet } from "react-router";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar />
      <div className="pl-[240px]">
        <AppHeader />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
