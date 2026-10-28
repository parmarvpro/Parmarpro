"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Runs a Server Action, shows a toast, exposes field errors and refreshes the
 * route on success. Server responses are authoritative.
 */
export function useActionSubmit<T>(options: { success?: string; onSuccess?: (data: T) => void } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function run(action: () => Promise<Result<T>>) {
    setFormError(null);
    startTransition(async () => {
      let result: Result<T>;
      try {
        result = await action();
      } catch {
        result = { ok: false, code: "internal", message: "Something went wrong. Please try again." };
      }
      if (result.ok) {
        setFieldErrors({});
        if (options.success) toast.success(options.success);
        options.onSuccess?.(result.data);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.message);
        toast.error(result.message);
      }
    });
  }

  return { pending, run, fieldErrors, formError, setFieldErrors };
}

export function formValues(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === "string") values[key] = value;
  });
  return values;
}
