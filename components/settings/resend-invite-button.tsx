"use client";

import { useActionState } from "react";
import { resendInvite } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/components/forms/use-action-toast";
import { RotateCw } from "lucide-react";

export function ResendInviteButton({ inviteId }: { inviteId: string }) {
  const [state, formAction, pending] = useActionState(resendInvite, null);
  useActionToast(state);

  return (
    <form action={formAction} style={{ display: "contents" }}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        title="Resend invite email"
      >
        <RotateCw size={14} />
      </Button>
    </form>
  );
}
