import { UserRound } from "lucide-react";

export function RequesterChips({ names }: { names: string[] }) {
  const uniqueNames = [...new Set(names.filter(Boolean))];
  if (uniqueNames.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {uniqueNames.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
        >
          <UserRound className="size-3" />
          {name}
        </span>
      ))}
    </div>
  );
}
