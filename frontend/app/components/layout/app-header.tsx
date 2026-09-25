import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, LogOut, PanelLeft, PanelLeftClose } from "lucide-react";

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
import { Badge } from "~/components/ui/badge";
import { employeeRoleLabels } from "~/components/employees/employees-types";
import { logoutUser, useCurrentUser } from "~/components/auth/session-store";

export function AppHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
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
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label={collapsed ? "Expandir panel lateral" : "Plegar panel lateral"}
        onClick={onToggle}
      >
        {collapsed ? <PanelLeft /> : <PanelLeftClose />}
      </Button>

      <div className="flex items-center gap-2">
        {currentUser ? (
          <>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background py-1 pr-3 pl-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-semibold text-white"
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm leading-tight font-medium">
                  {currentUser.firstName} {currentUser.lastName}
                </p>
                <Badge className="mt-0.5" variant="secondary">
                  {employeeRoleLabels[currentUser.role]}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notificaciones"
              onClick={() => undefined}
            >
              <Bell className="text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={() => setLogoutOpen(true)}
            >
              <LogOut className="text-muted-foreground" />
            </Button>
          </>
        ) : (
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Iniciar sesión
          </Link>
        )}
      </div>

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
    </header>
  );
}