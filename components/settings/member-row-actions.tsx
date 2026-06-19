"use client";

import { useActionState } from "react";
import { updateMemberRole, removeMember } from "@/app/settings/actions";
import { useActionToast } from "@/components/forms/use-action-toast";
import { Button } from "@/components/ui/button";

export function MemberRowActions({
  memberId,
  role,
}: {
  memberId: string;
  role: "admin" | "member";
}) {
  const [roleState, roleAction, rolePending] = useActionState(updateMemberRole, null);
  const [removeState, removeAction, removePending] = useActionState(removeMember, null);
  useActionToast(roleState);
  useActionToast(removeState);

  return (
    <>
      <form action={roleAction}>
        <input type="hidden" name="memberId" value={memberId} />
        <input
          type="hidden"
          name="role"
          value={role === "admin" ? "member" : "admin"}
        />
        <Button type="submit" variant="ghost" size="sm" disabled={rolePending}>
          Make {role === "admin" ? "member" : "admin"}
        </Button>
      </form>
      <form action={removeAction}>
        <input type="hidden" name="memberId" value={memberId} />
        <Button type="submit" variant="ghost" size="sm" disabled={removePending}>
          Remove
        </Button>
      </form>
    </>
  );
}
