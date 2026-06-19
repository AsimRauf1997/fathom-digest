"use client";

import { useState } from "react";
import React from "react";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { AuthShell } from "@/components/auth/AuthShell";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createUserRecord } from "./actions";

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

interface PageProps {
  searchParams: Promise<{ inviteToken?: string; complete?: string }>;
}

export default function SignupPage({ searchParams }: PageProps) {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Extract invite token from URL and handle OAuth completion
  React.useEffect(() => {
    const handleParams = async () => {
      const params = await searchParams;
      if (params.inviteToken) {
        setInviteToken(params.inviteToken);
      }

      // Handle OAuth completion (redirectUrlComplete)
      if (params.complete === "1" && params.inviteToken && isLoaded) {
        setLoading(true);
        try {
          // For Google OAuth, check if the session is active
          if (signUp && signUp.createdSessionId) {
            const { acceptSignupInvite } = await import("@/app/signup/actions");
            await acceptSignupInvite(params.inviteToken);
            window.location.href = "/";
            return;
          }
          // If no session yet, let the normal flow complete
        } catch (err) {
          console.error("Failed to accept invite:", err);
          setError("Failed to join team. Please contact support.");
        } finally {
          setLoading(false);
        }
      }
    };

    if (isLoaded) {
      handleParams();
    }
  }, [searchParams, isLoaded]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
      });
      console.log("result", result);
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });

        // Create user record in database
        await createUserRecord({
          id: result.createdUserId!,
          email,
          name: null,
          avatarUrl: null,
        });

        // If there's an invite token, accept the invite to auto-join the team
        if (inviteToken) {
          const { acceptSignupInvite } = await import("@/app/signup/actions");
          await acceptSignupInvite(inviteToken);
          window.location.href = "/";
        } else {
          window.location.href = "/onboarding";
        }
        return;
      }

      if (result.status === "missing_requirements") {
        await signUp.prepareEmailAddressVerification();
        setIsVerifying(true);
        setInfo(`Verification code sent to ${email}`);
        return;
      }

      setError("Could not complete sign up. Please try again.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !verificationCode) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });

        // Create user record in database
        await createUserRecord({
          id: result.createdUserId!,
          email,
          name: null,
          avatarUrl: null,
        });

        // If there's an invite token, accept the invite to auto-join the team
        if (inviteToken) {
          const { acceptSignupInvite } = await import("@/app/signup/actions");
          await acceptSignupInvite(inviteToken);
          window.location.href = "/";
        } else {
          window.location.href = "/onboarding";
        }
        return;
      }

      setError("Verification failed. Please check your code and try again.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const signUpWithGoogle = async () => {
    if (!isLoaded) return;
    setError(null);
    try {
      const redirectUrlComplete = inviteToken
        ? `/signup?inviteToken=${inviteToken}&complete=1`
        : "/onboarding";

      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthShell
      eyebrow="Get started"
      headline={
        <>
          Turn every recording into <em>a digest worth reading.</em>
        </>
      }
      tagline="Create your team's workspace, connect Fathom, and send your first digest in under five minutes."
    >
      <div className="auth-card-head">
        <span className="auth-eyebrow">Create account</span>
        <h1>Set up your workspace</h1>
        <p>It only takes a minute, no credit card required.</p>
      </div>

      <form onSubmit={isVerifying ? handleVerifyEmail : handleSignUp}>
        {!isVerifying ? (
          <>
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
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="At least 6 characters"
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
          </>
        ) : (
          <div className="stack">
            <Label htmlFor="code">Verification Code</Label>
            <p className="text-sm text-gray-600 mb-2">
              Enter the code we sent to {email}
            </p>
            <Input
              id="code"
              type="text"
              autoComplete="off"
              placeholder="000000"
              required
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              maxLength={6}
            />
          </div>
        )}

        {error && (
          <Alert variant="err" className="mb-4">
            {error}
          </Alert>
        )}
        {info && (
          <Alert variant="ok" className="mb-4">
            {info}
          </Alert>
        )}

        <div id="clerk-captcha" />

        <Button
          type="submit"
          variant="primary"
          size="primary"
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <span className="spinner" /> {isVerifying ? "Verifying…" : "Creating account…"}
            </>
          ) : (
            <>
              {isVerifying ? "Verify Email" : "Create account"} <ArrowRight size={15} />
            </>
          )}
        </Button>
      </form>

      {!isVerifying && (
        <>
          <div className="auth-divider">Or continue with</div>

          <Button
            variant="outline"
            className="w-full"
            onClick={signUpWithGoogle}
            type="button"
          >
            <GoogleMark /> Continue with Google
          </Button>
        </>
      )}

      <p className="auth-foot">
        {isVerifying ? (
          <>
            Wrong email?{" "}
            <button
              type="button"
              onClick={() => {
                setIsVerifying(false);
                setVerificationCode("");
                setInfo(null);
              }}
              className="link"
            >
              Start over
            </button>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}
