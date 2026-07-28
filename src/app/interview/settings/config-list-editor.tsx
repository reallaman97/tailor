"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusIcon, ChevronDownIcon } from "@/components/icons";

export type ConfigItem = { id: string; label: string; active: boolean };
type Result = { error?: string };

/**
 * Generic editor for a label-only config list (Interview Process stages, Meeting
 * Types): add, rename inline, activate/deactivate, and reorder. The concrete
 * server actions are injected as props so this component stays list-agnostic.
 */
export function ConfigListEditor({
  title,
  description,
  items,
  onCreate,
  onRename,
  onToggle,
  onMove,
}: {
  title: string;
  description?: string;
  items: ConfigItem[];
  onCreate: (label: string) => Promise<Result>;
  onRename: (id: string, label: string) => Promise<Result>;
  onToggle: (id: string, active: boolean) => Promise<Result>;
  onMove: (id: string, direction: "up" | "down") => Promise<Result>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const result = await onCreate(label);
      if (result?.error) setError(result.error);
      else setNewLabel("");
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <Alert variant="destructive">{error}</Alert>}

        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <ConfigRow
              key={item.id}
              item={item}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onRename={onRename}
              onToggle={onToggle}
              onMove={onMove}
              onError={setError}
            />
          ))}
          {items.length === 0 && <li className="text-sm text-muted-foreground">No options yet.</li>}
        </ul>

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={`Add a ${title.toLowerCase().replace(/s$/, "")}…`}
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

function ConfigRow({
  item,
  isFirst,
  isLast,
  onRename,
  onToggle,
  onMove,
  onError,
}: {
  item: ConfigItem;
  isFirst: boolean;
  isLast: boolean;
  onRename: (id: string, label: string) => Promise<Result>;
  onToggle: (id: string, active: boolean) => Promise<Result>;
  onMove: (id: string, direction: "up" | "down") => Promise<Result>;
  onError: (message: string | null) => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<Result>) => {
    onError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) onError(result.error);
    });
  };

  const commitRename = () => {
    const next = label.trim();
    if (!next || next === item.label) {
      setLabel(item.label);
      return;
    }
    call(() => onRename(item.id, next));
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

      <Input
        value={label}
        disabled={pending}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitRename}
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
