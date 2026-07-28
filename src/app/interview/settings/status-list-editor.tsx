"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusIcon, ChevronDownIcon } from "@/components/icons";

export type StatusItem = { id: string; label: string; color: string; active: boolean };
type Result = { error?: string };

/** Editor for the Status list — like the generic one, plus a per-status color. */
export function StatusListEditor({
  items,
  onCreate,
  onUpdate,
  onToggle,
  onMove,
}: {
  items: StatusItem[];
  onCreate: (label: string, color: string) => Promise<Result>;
  onUpdate: (id: string, label: string, color: string) => Promise<Result>;
  onToggle: (id: string, active: boolean) => Promise<Result>;
  onMove: (id: string, direction: "up" | "down") => Promise<Result>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const result = await onCreate(label, newColor);
      if (result?.error) setError(result.error);
      else setNewLabel("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statuses</CardTitle>
        <CardDescription>
          The outcome states an interview can be in. Colors are used on the calendar and list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Alert variant="destructive">{error}</Alert>}

        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <StatusRow
              key={item.id}
              item={item}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onUpdate={onUpdate}
              onToggle={onToggle}
              onMove={onMove}
              onError={setError}
            />
          ))}
          {items.length === 0 && <li className="text-sm text-muted-foreground">No statuses yet.</li>}
        </ul>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <input
            type="color"
            aria-label="New status color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-10 cursor-pointer rounded-md border border-input bg-card p-1"
          />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add a status…"
            className="max-w-xs"
          />
          <Button type="button" size="sm" onClick={add} loading={pending} disabled={!newLabel.trim()}>
            <PlusIcon className="size-4" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  item,
  isFirst,
  isLast,
  onUpdate,
  onToggle,
  onMove,
  onError,
}: {
  item: StatusItem;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: string, label: string, color: string) => Promise<Result>;
  onToggle: (id: string, active: boolean) => Promise<Result>;
  onMove: (id: string, direction: "up" | "down") => Promise<Result>;
  onError: (message: string | null) => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [color, setColor] = useState(item.color);
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<Result>) => {
    onError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) onError(result.error);
    });
  };

  const commit = (nextLabel: string, nextColor: string) => {
    const trimmed = nextLabel.trim();
    if (!trimmed || (trimmed === item.label && nextColor === item.color)) {
      setLabel(item.label);
      setColor(item.color);
      return;
    }
    call(() => onUpdate(item.id, trimmed, nextColor));
  };

  return (
    <li className="flex items-center gap-2">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label="Move up"
          disabled={isFirst || pending}
          onClick={() => call(() => onMove(item.id, "up"))}
          className="flex h-4 items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDownIcon className="size-3 rotate-180" />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={isLast || pending}
          onClick={() => call(() => onMove(item.id, "down"))}
          className="flex h-4 items-center text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronDownIcon className="size-3" />
        </button>
      </div>

      <input
        type="color"
        aria-label={`${item.label} color`}
        value={color}
        disabled={pending}
        onChange={(e) => setColor(e.target.value)}
        onBlur={() => commit(label, color)}
        className="h-9 w-10 cursor-pointer rounded-md border border-input bg-card p-1"
      />

      <Input
        value={label}
        disabled={pending}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => commit(label, color)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className={item.active ? "max-w-xs" : "max-w-xs text-muted-foreground"}
      />

      {!item.active && <Badge variant="secondary">Inactive</Badge>}

      <div className="ml-auto">
        <Button
          type="button"
          size="sm"
          variant={item.active ? "outline" : "secondary"}
          loading={pending}
          onClick={() => call(() => onToggle(item.id, !item.active))}
        >
          {item.active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    </li>
  );
}
