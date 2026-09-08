import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldCheck, User as UserIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function UsersTab() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => base44.entities.User.list("-created_date"),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-users"] }),
  });

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <h1 className="font-display text-3xl text-brand-dark mb-1">Users</h1>
      <p className="font-body text-sm text-brand-dark/50 mb-6">
        Everyone registered. Toggle the switch to make someone an admin.
      </p>

      {isLoading ? (
        <p className="text-brand-dark/40 text-center py-10 font-body">Loading…</p>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isAdmin = u.role === "admin";
            const pending = roleMutation.isPending && roleMutation.variables?.id === u.id;
            return (
              <div
                key={u.id}
                className="bg-brand-cream-card rounded-2xl shadow-sm p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${isAdmin ? "bg-brand-teal/10 text-brand-teal" : "bg-brand-gold/15 text-brand-gold"}`}>
                    {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-base text-brand-dark leading-tight truncate">
                      {u.full_name || u.email}
                    </p>
                    <p className="font-body text-xs text-brand-dark/50 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pending && <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />}
                  <span className={`font-body text-xs font-medium ${isAdmin ? "text-brand-teal" : "text-brand-dark/40"}`}>
                    {isAdmin ? "Admin" : "User"}
                  </span>
                  <Switch
                    checked={isAdmin}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      roleMutation.mutate({ id: u.id, role: checked ? "admin" : "user" })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}