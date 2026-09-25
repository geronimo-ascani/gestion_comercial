import { useState } from "react";
import { Outlet } from "react-router";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { cn } from "~/lib/utils";

const SIDEBAR_KEY = "gc-sidebar-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_KEY) === "1";
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  function toggleSidebar() {
    setCollapsed((previous) => {
      const next = !previous;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar collapsed={collapsed} />
      <div
        className={cn(
          "transition-[padding-left] duration-200",
          collapsed ? "pl-16" : "pl-[240px]"
        )}
      >
        <AppHeader collapsed={collapsed} onToggle={toggleSidebar} />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}