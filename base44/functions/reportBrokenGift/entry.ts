import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { gift_item_id } = await req.json().catch(() => ({}));
    if (!gift_item_id) return Response.json({ error: "gift_item_id is required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const item = await svc.entities.GiftItem.get(gift_item_id).catch(() => null);
    const list = item ? await svc.entities.GiftList.get(item.gift_list_id).catch(() => null) : null;
    if (!item || !list || list.subscriber_user_id !== user.id || list.visible_to_subscriber !== true) {
      return Response.json({ error: "Gift item not found" }, { status: 404 });
    }

    if (item.product_id && item.product_id !== "manual") {
      await svc.entities.Product.update(item.product_id, {
        status: "reported_broken",
        reported_broken_at: new Date().toISOString().slice(0, 10),
      }).catch(() => null);
    }
    await svc.entities.GiftItem.update(item.id, {
      status: "removed",
      admin_feedback_reason: "bad_link_or_data",
      admin_feedback_note: "Reported by subscriber",
    });

    const standby = await svc.entities.GiftItem.filter({ gift_list_id: list.id, status: "standby" });
    standby.sort((a, b) => Number(b.selection_score || 0) - Number(a.selection_score || 0));
    const replacement = standby[0] || null;
    if (replacement) await svc.entities.GiftItem.update(replacement.id, { status: "active" });
    return Response.json({ replaced: !!replacement, replacement_title: replacement?.title || "" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
