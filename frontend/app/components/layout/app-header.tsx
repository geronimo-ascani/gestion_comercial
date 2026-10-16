import { Bell, Moon, PanelLeft, PanelLeftClose, Sun } from "lucide-react";

import { useTheme } from "~/lib/theme";
import { Button } from "~/components/ui/button";

export function AppHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={collapsed ? "Expandir panel lateral" : "Plegar panel lateral"}
          onClick={onToggle}
        >
          {collapsed ? <PanelLeft className="size-5" /> : <PanelLeftClose className="size-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={
            theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"
          }
          onClick={toggleTheme}
        >
          {theme === "dark" ? (
            <Sun className="size-5 text-muted-foreground" />
          ) : (
            <Moon className="size-5 text-muted-foreground" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones"
          onClick={() => undefined}
        >
          <Bell className="text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
