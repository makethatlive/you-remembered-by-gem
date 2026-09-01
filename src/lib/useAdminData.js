import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useAdminData() {
  const subscribers = useQuery({ queryKey: ["subscribers"], queryFn: () => base44.entities.Subscriber.list("-created_date", 5000) });
  const recipients = useQuery({ queryKey: ["recipients-all"], queryFn: () => base44.entities.Recipient.list("-created_date", 5000) });
  const lists = useQuery({ queryKey: ["giftlists-all"], queryFn: () => base44.entities.GiftList.list("-created_date", 5000) });
  const items = useQuery({ queryKey: ["giftitems-all"], queryFn: () => base44.entities.GiftItem.list("-created_date", 5000) });
  const emails = useQuery({ queryKey: ["emails-all"], queryFn: () => base44.entities.EmailLog.list() });

  return {
    subscribers: subscribers.data || [],
    recipients: recipients.data || [],
    lists: lists.data || [],
    items: items.data || [],
    emails: emails.data || [],
    isLoading: subscribers.isLoading || recipients.isLoading || lists.isLoading || items.isLoading,
  };
}
