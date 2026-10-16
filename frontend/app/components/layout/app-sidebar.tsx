import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { LayoutDashboard, LogOut } from "lucide-react";

import { cn } from "~/lib/utils";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { appConfig, navItems } from "~/config/app";
import { employeeRoleLabels } from "~/components/employees/employees-types";
import { logoutUser, useCurrentUser } from "~/components/auth/session-store";

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const currentUser = useCurrentUser();

  const initials = currentUser
    ? `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`.toUpperCase()
    : "";

  function handleLogout() {
    logoutUser();
    navigate("/login");
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-200",
        collapsed ? "w-16" : "w-[240px]"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2",
          collapsed ? "justify-center px-2" : "px-6"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold">{appConfig.title}</span>
        )}
      </div>

      <Separator />

      <nav
        className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-3")}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {currentUser && (
        <>
          <Separator />
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed ? "justify-center p-2" : "p-3"
            )}
          >
            {collapsed ? (
              <button
                type="button"
                aria-label="Cerrar sesión"
                title={`${currentUser.firstName} ${currentUser.lastName} · Cerrar sesión`}
                onClick={() => setLogoutOpen(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {initials}
              </button>
            ) : (
              <>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-semibold text-white"
                  aria-hidden="true"
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-tight font-medium">
                    {currentUser.firstName} {currentUser.lastName}
                  </p>
                  <Badge className="mt-0.5" variant="secondary">
                    {employeeRoleLabels[currentUser.role]}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar sesión"
                  onClick={() => setLogoutOpen(true)}
                >
                  <LogOut className="size-4 text-muted-foreground" />
                </Button>
              </>
            )}
          </div>
        </>
      )}

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Se cerrará la sesión actual y volverá al inicio de sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <DialogClose
              render={<Button variant="destructive" onClick={handleLogout} />}
            >
              Cerrar sesión
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
