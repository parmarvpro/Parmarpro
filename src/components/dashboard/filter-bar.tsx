"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

export type FilterSelect = { name: string; label: string; options: { value: string; label: string }[] };

/** URL-driven filters (server pages read them from searchParams and re-validate). */
export function FilterBar({ search, selects }: { search?: { placeholder: string }; selects: FilterSelect[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(next: Record<string, string>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    merged.delete("page");
    startTransition(() => router.push(`${pathname}?${merged.toString()}`));
  }

  const hasFilters = [...params.keys()].some((key) => key !== "page");

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center" aria-busy={pending}>
      {search ? (
        <form
          className="relative min-w-56 flex-1"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("q");
            apply({ q: typeof value === "string" ? value.trim() : "" });
          }}
        >
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={params.get("q") ?? ""} placeholder={search.placeholder} className="pl-8" aria-label={search.placeholder} maxLength={80} />
        </form>
      ) : null}
      {selects.map((select) => (
        <div key={select.name} className="sm:w-44">
          <NativeSelect aria-label={select.label} value={params.get(select.name) ?? ""} onChange={(event) => apply({ [select.name]: event.target.value })}>
            <option value="">{select.label}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.push(pathname))}>
          <XIcon /> Clear
        </Button>
      ) : null}
    </div>
  );
}
