"use client";

import { useActionState } from "react";
import { createTeam } from "@/app/onboarding/actions";
import { useActionToast } from "@/components/forms/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(createTeam, null);
  useActionToast(state);

  return (
    <form action={formAction}>
      <div className="stack">
        <Label htmlFor="name">Team name</Label>
        <div className="auth-field">
          <Building2 size={16} className="field-icon" />
          <Input id="name" name="name" required placeholder="Acme Inc." />
        </div>
      </div>

      <div className="stack">
        <Label htmlFor="fathomKey">Fathom API key (optional)</Label>
        <div className="auth-field">
          <KeyRound size={16} className="field-icon" />
          <Input
            id="fathomKey"
            name="fathomKey"
            type="password"
            placeholder="Paste your Fathom API key"
          />
        </div>
        <p className="auth-hint">
          <ShieldCheck size={13} />
          Used to fetch meetings for the whole team. Skip this and add it
          later from Settings.
        </p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="primary"
        className="w-full"
        disabled={pending}
      >
        {pending ? (
          "Creating…"
        ) : (
          <>
            Create team <ArrowRight size={15} />
          </>
        )}
      </Button>
    </form>
  );
}
