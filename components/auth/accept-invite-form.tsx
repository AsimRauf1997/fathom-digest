"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { acceptInvite } from "@/app/accept-invite/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Lock, Eye, EyeOff } from "lucide-react";

export function AcceptInviteForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

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
      <div className="stack">
        <Label htmlFor="password">Password</Label>
        <div className="auth-field">
          <Lock size={16} className="field-icon" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="field-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="stack">
        <Label htmlFor="confirm">Confirm password</Label>
        <div className="auth-field">
          <Lock size={16} className="field-icon" />
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

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
            <span className="spinner" /> Setting password…
          </>
        ) : (
          "Set password & join team"
        )}
      </Button>
    </form>
  );
}
