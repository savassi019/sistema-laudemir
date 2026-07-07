"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";

import { markReminderDoneAction } from "@/server/actions/reminder-actions";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ReminderItem } from "@/types/app";

export function RemindersSection({
  reminders,
  maxItems = 4,
}: {
  reminders: ReminderItem[];
  maxItems?: number;
}) {
  const [items, setItems] = useState(reminders);
  const [isPending, startTransition] = useTransition();

  function markDone(id: string) {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "feito" as const } : r)),
    );
    startTransition(async () => {
      await markReminderDoneAction(id);
    });
  }

  const open = items.filter((r) => r.status === "aberto");
  const shown = open.slice(0, maxItems);

  if (shown.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center">
        <Check className="mb-2 size-5 text-[#8aa17c]" />
        <p className="text-sm text-[#9a958b]">Nenhuma pendência em aberto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shown.map((reminder) => (
        <article
          key={reminder.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(245,241,232,0.08)] bg-[#0b0f0e]/55 px-3 py-3"
        >
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{reminder.title}</h3>
            <p className="mt-1 text-xs text-[#9a958b]">
              {reminder.owner} - {reminder.dueAt}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge label="pendente" />
            <button
              type="button"
              disabled={isPending}
              onClick={() => markDone(reminder.id)}
              title="Marcar como feito"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#8aa17c]/30 bg-[#8aa17c]/10 text-[#8aa17c] transition hover:bg-[#8aa17c]/20 disabled:opacity-50"
            >
              <Check className="size-4" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
