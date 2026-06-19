"use client";

import { useActionState } from "react";
import { updateFathomKey } from "@/app/settings/actions";
import { useActionToast } from "@/components/forms/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FathomKeyForm({ hasFathomKey }: { hasFathomKey: boolean }) {
  const [state, formAction, pending] = useActionState(updateFathomKey, null);
  useActionToast(state);

  return (
    <form action={formAction} className="mb-6">
      <div className="stack">
        <Label htmlFor="fathomKey">
          {hasFathomKey ? "Replace key" : "Add key"}
        </Label>
        <Input
          id="fathomKey"
          name="fathomKey"
          type="password"
          placeholder="Paste your Fathom API key"
          required
        />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save key"}
      </Button>
    </form>
  );
}
