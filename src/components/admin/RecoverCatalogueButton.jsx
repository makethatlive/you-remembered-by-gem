import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function RecoverCatalogueButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const runRecovery = async () => {
    setRunning(true);
    setOpen(false);
    
    try {
      const response = await fetch(`${API_URL}/api/products/recover-catalogue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Recovery failed');
      }
      
      const data = await response.json();
      
      toast({
        description: `Checked ${data.checked ?? 0} inactive products — ${data.recovered_to_review ?? 0} moved to review, ${data.confirmed_gone ?? 0} confirmed gone, ${data.excluded_as_junk ?? 0} excluded as junk.`,
      });
      
      // Refresh products list
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      console.error('Recovery error:', error);
      toast({ 
        variant: "destructive",
        description: error.message || "Recovery couldn't complete — please try again." 
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={running}
        className="inline-flex items-center gap-2 border border-brand-gold/60 text-brand-teal font-body text-sm font-medium rounded-full px-4 py-2.5 min-h-[44px] hover:bg-brand-gold-soft/20 disabled:opacity-50"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArchiveRestore className="w-4 h-4" />}
        {running ? "Recovering…" : "Recover old catalogue"}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Recover old catalogue</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              This will check every inactive product. Plausible products move to "Needs review" for your approval — nothing is activated automatically, and confirmed-gone or junk products stay inactive. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="font-body bg-brand-teal hover:bg-brand-teal-dark"
              onClick={runRecovery}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}