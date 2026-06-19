"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";

export function useActionToast(state: ActionState) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state?.error]);
}
