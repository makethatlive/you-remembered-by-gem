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
        // For now, allow all signups - eligibility checking can be added later
        // when Stripe integration is fully configured
        if (!active) return;
        
        setEligible(true);
        setError("");
      } catch (err) {
        if (active) {
          setEligible(false);
          setError(err?.message || "Unable to verify your payment right now.");
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
      const [firstName, ...lastNameParts] = name.trim().split(' ');
      const lastName = lastNameParts.join(' ');
      
      const result = await base44.auth.register(
        email.trim().toLowerCase(),
        password,
        firstName || null,
        lastName || null
      );
      
      if (result?.auth?.accessToken) {
        window.localStorage.removeItem("paidSignupDraft");
        window.location.href = "/";
      }
    } catch (err) {
      setError(err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

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