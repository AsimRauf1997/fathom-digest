"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs/legacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "@/components/auth/AuthShell";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.55-1.84.86-3.06.86-2.36 0-4.36-1.6-5.07-3.74H.97v2.33A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.93 10.68A5.41 5.41 0 0 1 3.64 9c0-.58.1-1.16.29-1.68V4.99H.97A8.997 8.997 0 0 0 0 9c0 1.45.35 2.83.97 4.01l2.96-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.59 8.59 0 0 0 9 0 8.997 8.997 0 0 0 .97 4.99l2.96 2.33C4.64 5.18 6.64 3.58 9 3.58z"
      />
    </svg>
  );
}

function errorMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as { errors: unknown }).errors)
  ) {
    const first = (err as { errors: { message?: string }[] }).errors[0];
    if (first?.message) return first.message;
  }
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        window.location.href = "/";
        return;
      }
      console.log({ result });
      setError("Could not complete sign in. Please try again.");
    } catch (err) {
      console.error(err);
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      headline={
        <>
          Pick up exactly where <em>the room left off.</em>
        </>
      }
      tagline="Sign in to review your latest Fathom recordings and send the digest before anyone asks what they missed."
    >
      <div className="auth-card-head">
        <span className="auth-eyebrow">Sign in</span>
        <h1>Welcome back</h1>
        <p>Enter your credentials to access your team&apos;s digests.</p>
      </div>

      <form onSubmit={signInWithPassword}>
        <div className="stack">
          <Label htmlFor="email">Email</Label>
          <div className="auth-field">
            <Mail size={16} className="field-icon" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="stack">
          <Label htmlFor="password">Password</Label>
          <div className="auth-field">
            <Lock size={16} className="field-icon" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              <span className="spinner" /> Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight size={15} />
            </>
          )}
        </Button>
      </form>

      <div className="auth-divider">Or continue with</div>

      <Button
        variant="outline"
        className="w-full"
        onClick={signInWithGoogle}
        type="button"
      >
        <GoogleMark /> Continue with Google
      </Button>

      <p className="auth-foot">
        No account? <Link href="/signup">Sign up</Link>
      </p>
    </AuthShell>
  );
}
