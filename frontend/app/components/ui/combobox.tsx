import { useState } from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { Command } from "cmdk";
import * as Popover from "@radix-ui/react-popover";

import { cn } from "~/lib/utils";

export interface ComboboxOption<TValue extends string = string> {
  value: TValue;
  label: string;
  description?: string;
  keywords?: string[];
}

interface ComboboxProps<TValue extends string = string> {
  id?: string;
  value?: TValue;
  onValueChange: (value: TValue) => void;
  options: ComboboxOption<TValue>[];
  placeholder?: string;
  searchPlaceholder?: string;
  notFoundText?: string;
  emptyText?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
  className?: string;
}

export function Combobox<TValue extends string = string>({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  notFoundText = "No se encontraron resultados",
  emptyText = "No hay opciones disponibles",
  disabled,
  ariaInvalid,
  className,
}: ComboboxProps<TValue>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-invalid={ariaInvalid || undefined}
          disabled={disabled}
          className={cn(
            "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className
          )}
        >
          <span
            className={cn(
              "line-clamp-1 text-left",
              !selected && "text-muted-foreground"
            )}
          >
            {selected
              ? selected.label
              : options.length === 0
                ? emptyText
                : placeholder}
          </span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-48 origin-(--radix-popover-content-transform-origin) rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <Command>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <SearchIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
              <Command.Input
                placeholder={searchPlaceholder}
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-64 overflow-y-auto overflow-x-hidden p-1">
              <Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
                {options.length === 0 ? emptyText : notFoundText}
              </Command.Empty>
              {options.map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.label}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                    option.value === value && "font-medium"
                  )}
                >
                  <span className="line-clamp-1 flex-1 text-left">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                  {option.value === value && (
                    <CheckIcon className="absolute right-2 size-4 shrink-0" />
                  )}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}