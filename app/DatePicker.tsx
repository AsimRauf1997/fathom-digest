"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shortLabel(s: string): string {
  const d = parseYMD(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DatePicker({
  value,
  onChange,
  max,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  max?: string;
  onEnter?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseYMD(value);
  const [month, setMonth] = useState(selected);
  const maxDate = max ? parseYMD(max) : undefined;

  const pick = (d: Date | undefined) => {
    if (!d) return;
    if (maxDate && d > maxDate) return;
    onChange(toYMD(d));
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setMonth(parseYMD(value));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !open) onEnter?.();
          }}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-sm)] border border-input bg-[var(--paper-3)] px-3.5 py-1.5 text-left font-sans text-[14px] text-foreground transition-colors",
            "hover:border-ink-soft",
            "data-[state=open]:border-accent data-[state=open]:ring-4 data-[state=open]:ring-accent-wash data-[state=open]:outline-none"
          )}
        >
          <CalendarIcon className="size-4 text-accent" aria-hidden />
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {shortLabel(value)}
          </span>
          <span className="text-[9px] text-muted-foreground" aria-hidden>
            {open ? "▴" : "▾"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[296px] p-4">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={pick}
          month={month}
          onMonthChange={setMonth}
          disabled={maxDate ? { after: maxDate } : undefined}
          components={{
            CaptionLabel: ({ children, ...props }) => {
              const text = String(children ?? "");
              const idx = text.lastIndexOf(" ");
              const monthPart = idx === -1 ? text : text.slice(0, idx);
              const yearPart = idx === -1 ? "" : text.slice(idx + 1);
              return (
                <span {...props}>
                  {monthPart} <span className="font-normal text-ink-faint">{yearPart}</span>
                </span>
              );
            },
          }}
        />
        <div className="mt-3 border-t border-rule pt-3 text-center">
          <button
            type="button"
            className="font-mono text-[10.5px] tracking-[0.04em] text-ink-faint uppercase transition-colors hover:text-accent"
            onClick={() => pick(new Date())}
          >
            Today — {shortLabel(toYMD(new Date()))}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
