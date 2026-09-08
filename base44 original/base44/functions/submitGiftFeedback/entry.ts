import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Subscriber gift feedback capture (C2.4). Auth and ownership are modelled on
// reportBrokenGift: the caller must be authenticated, and the item's parent GiftList must
// both belong to that user and already be visible to them — otherwise the item is treated
// as not found. No emails, no AI.

const FEEDBACK_VALUES = ["loved_it", "bad_suggestion"];
const ACTION_VALUES = ["purchased", "not_purchased"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { gift_item_id, feedback, subscriber_action } = await req.json().catch(() => ({}));
    if (!gift_item_id) return Response.json({ error: "gift_item_id is required" }, { status: 400 });
    if (!feedback && !subscriber_action) {
      return Response.json({ error: "feedback or subscriber_action is required" }, { status: 400 });
    }
    if (feedback && !FEEDBACK_VALUES.includes(feedback)) {
      return Response.json({ error: "Invalid feedback value" }, { status: 400 });
    }
    if (subscriber_action && !ACTION_VALUES.includes(subscriber_action)) {
      return Response.json({ error: "Invalid subscriber_action value" }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const item = await svc.entities.GiftItem.get(gift_item_id).catch(() => null);
    const list = item ? await svc.entities.GiftList.get(item.gift_list_id).catch(() => null) : null;
    if (!item || !list || list.subscriber_user_id !== user.id || list.visible_to_subscriber !== true) {
      return Response.json({ error: "Gift item not found" }, { status: 404 });
    }

    const updates = {};
    if (feedback) updates.feedback = feedback;
    if (subscriber_action) updates.subscriber_action = subscriber_action;

    await svc.entities.GiftItem.update(item.id, updates);
    return Response.json({ status: "ok", ...updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
