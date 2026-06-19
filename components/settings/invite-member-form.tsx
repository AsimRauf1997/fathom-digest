"use client";

import { useActionState } from "react";
import { inviteMember } from "@/app/settings/actions";
import { useActionToast } from "@/components/forms/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(inviteMember, null);
  useActionToast(state);

  return (
    <form action={formAction}>
      <div className="stack">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
