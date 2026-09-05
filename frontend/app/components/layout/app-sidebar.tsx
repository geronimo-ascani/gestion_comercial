import { NavLink } from "react-router";
import { LayoutDashboard } from "lucide-react";

import { cn } from "~/lib/utils";
import { Separator } from "~/components/ui/separator";
import { appConfig, navItems } from "~/config/app";

export function AppSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">{appConfig.title}</span>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}