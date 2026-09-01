import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Mail, Loader2, Check } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Sends a Base44 invitation to a new person. Admin invitees see the admin dashboard;
// user invitees see the subscriber app — that role behaviour lives in Home.jsx.
export default function InviteUserForm({ onDone }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await base44.users.inviteUser(trimmed, role);
      setSent(true);
    } catch (err) {
      setError(err?.message || "Could not send the invitation. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 text-brand-teal">
          <Check className="w-5 h-5" />
          <p className="font-display text-lg text-brand-dark">Invitation sent to {email.trim()}</p>
        </div>
        <p className="font-body text-sm text-brand-dark/60 mt-1">
          They'll receive an email to set up their login. Once accepted, they'll appear in your Users list.
        </p>
        <button
          onClick={onDone}
          className="mt-4 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-brand-cream-card rounded-2xl shadow-sm p-6 mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-brand-gold" />
        <h2 className="font-display text-xl text-brand-dark">Invite a Person</h2>
      </div>

      <div>
        <label className="block font-body text-sm text-brand-dark/70 mb-1">Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full h-11 rounded-xl border border-brand-gold/30 bg-brand-cream px-3 font-body text-sm text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40"
        />
      </div>

      <div>
        <label className="block font-body text-sm text-brand-dark/70 mb-1">Role</label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-11 w-full bg-brand-cream"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User — subscriber app</SelectItem>
            <SelectItem value="admin">Admin — full dashboard access</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="font-body text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          {sending ? "Sending…" : "Send Invitation"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="font-body text-sm text-brand-dark/60 hover:text-brand-dark px-4 py-2.5 min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}