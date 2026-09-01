import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/components/ui/use-toast";
import AuthLayout from "@/components/AuthLayout";

export default function CreateAccount() {
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const queryEmail = (urlParams.get("email") || "").trim().toLowerCase();

  const [email, setEmail] = useState(queryEmail);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const draftRaw = window.localStorage.getItem("paidSignupDraft");
    const draft = draftRaw ? JSON.parse(draftRaw) : null;

    if (draft?.email && (!queryEmail || draft.email === queryEmail)) {
      setEmail(draft.email);
      setName(draft.name || "");
      setPassword(draft.password || "");
      setConfirmPassword(draft.password || "");
    }
  }, [queryEmail]);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      const currentEmail = (queryEmail || email).trim().toLowerCase();
      if (!currentEmail) {
        if (active) {
          setEligible(false);
          setCheckingAccess(false);
          setError("We could not find your payment details. Please start again.");
        }
        return;
      }

      try {
        // Eligibility is resolved server-side: this page is pre-auth, so it cannot read
        // Subscriber records directly. The endpoint returns a boolean and nothing else.
        const res = await base44.functions.invoke("checkSignupEligibility", { email: currentEmail });
        const data = res?.data || {};

        if (!active) return;

        if (data.eligible) {
          setEligible(true);
          setError("");
        } else {
          setEligible(false);
          setError("We could not find an active subscription for this email yet. Please wait a moment and try again.");
        }
      } catch (err) {
        if (active) {
          setEligible(false);
          setError(err?.response?.data?.error || "Unable to verify your payment right now.");
        }
      } finally {
        if (active) {
          setCheckingAccess(false);
        }
      }
    };

    // The email field updates on every keystroke, so run the pre-auth eligibility
    // check only once the address has settled rather than once per character.
    const debounce = setTimeout(checkAccess, 500);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [email, queryEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!eligible) {
      setError("Your payment has not been confirmed yet.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim().toLowerCase(), password });
      window.localStorage.setItem(
        "paidSignupDraft",
        JSON.stringify({ name, email: email.trim().toLowerCase(), password })
      );
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim().toLowerCase(), otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      await base44.functions.invoke("completePaidSignup", {});
      window.localStorage.removeItem("paidSignupDraft");
      window.location.href = "/";
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email.trim().toLowerCase());
      toast({
        title: "Code sent",
        description: "Check your email for the new code.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    }
  };

  if (showOtp) {
    return (
      <AuthLayout icon={Mail} title="Verify your email" subtitle={`We sent a code to ${email}`}>
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="mb-6 flex justify-center">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button className="h-12 w-full font-medium" onClick={handleVerify} disabled={loading || otpCode.length < 6}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Finishing account...
            </>
          ) : (
            "Finish account"
          )}
        </Button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="font-medium text-primary hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={ShieldCheck}
      title="Create your account"
      subtitle="Your payment is complete — now set your login details"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {checkingAccess ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking your payment...
        </div>
      ) : !eligible ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">Please return to signup if you still need to complete payment.</p>
          <Button asChild className="h-12 w-full font-medium">
            <Link to="/signup">Back to signup</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                className="h-12 pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}