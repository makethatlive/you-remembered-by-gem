import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";

export default function Register() {
  const [stage, setStage] = useState("details"); // "details" | "otp"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await base44.auth.register({ email: email.trim().toLowerCase(), password });
      // Preserve the name so it can be used when the Subscriber record is created
      // right after onboarding (Register itself has no Subscriber to write to yet).
      window.localStorage.setItem("pendingSubscriberName", name.trim());
      setStage("otp");
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email: email.trim().toLowerCase(), otpCode: otp });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      // New account → straight into onboarding, then the dashboard.
      window.location.href = "/onboarding";
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "That code didn't work. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email.trim().toLowerCase());
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Unable to resend the code.");
    }
  };

  if (stage === "otp") {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`Enter the 6-digit code we sent to ${email}`}
        footer={
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend code
          </button>
        }
      >
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button type="submit" className="h-12 w-full font-medium" disabled={loading || otp.length < 6}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify & Continue"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="It's free to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name" type="text" autoComplete="name" autoFocus
            placeholder="Your full name" value={name}
            onChange={(e) => setName(e.target.value)} className="h-12" required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email" type="email" autoComplete="email"
              placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} className="h-12 pl-10" required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password" type="password" autoComplete="new-password"
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} className="h-12 pl-10" required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm" type="password" autoComplete="new-password"
              placeholder="••••••••" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} className="h-12 pl-10" required
            />
          </div>
        </div>

        <Button type="submit" className="h-12 w-full font-medium" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}