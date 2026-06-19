"use client";

import { useState } from "react";
import { acceptInvite } from "@/app/accept-invite/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function AcceptInviteExistingForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const acceptError = await acceptInvite();
    setLoading(false);

    if (acceptError?.error) {
      setError(acceptError.error);
      return;
    }

    window.location.href = "/";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="err" className="mb-4">
          {error}
        </Alert>
      )}

      <Button
        type="submit"
        variant="primary"
        size="primary"
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <>
            <span className="spinner" /> Joining team…
          </>
        ) : (
          "Accept invite & join team"
        )}
      </Button>
    </form>
  );
}
