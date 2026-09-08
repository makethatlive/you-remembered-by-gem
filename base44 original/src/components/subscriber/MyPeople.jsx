import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RecipientCard from "./RecipientCard";

export default function MyPeople({ subscriber, onEdit, onAdd }) {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = React.useState(null);

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["recipients", subscriber?.id],
    queryFn: () => base44.entities.Recipient.filter({ subscriber_id: subscriber.id }),
    enabled: !!subscriber,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Recipient.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipients", subscriber?.id] });
      setToDelete(null);
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-5 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl sm:text-3xl text-brand-dark">My People</h1>
        {recipients.length < 10 && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 bg-brand-teal text-brand-cream font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-teal-dark"
          >
            <Plus className="w-4 h-4" /> Add Recipient
          </button>
        )}
      </div>

      {recipients.length >= 10 && (
        <p className="font-body text-sm text-brand-dark/60 bg-brand-cream-card rounded-2xl shadow-sm px-5 py-4 mb-6">
          You've added 10 people — that's your full list. Get in touch if you'd like to make changes.
        </p>
      )}

      {isLoading ? (
        <p className="text-brand-dark/40 text-center py-10 font-body">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipients.map((r) => (
            <RecipientCard key={r.id} recipient={r} onEdit={onEdit} onDelete={setToDelete} />
          ))}
        </div>
      )}

      {recipients.length === 0 && !isLoading && (
        <p className="font-body text-sm text-brand-dark/50 text-center py-12">
          No one added yet. Add the people you never want to forget.
        </p>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {toDelete?.name} from your list. If their details have just changed, editing their profile and refreshing suggestions keeps everything Gem has learned about them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteMutation.mutate(toDelete.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}