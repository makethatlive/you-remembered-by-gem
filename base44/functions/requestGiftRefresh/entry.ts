import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { gift_list_id, refresh_reason } = await req.json().catch(() => ({}));
    if (!gift_list_id) return Response.json({ error: "gift_list_id is required" }, { status: 400 });

    const svc = base44.asServiceRole;
    const list = await svc.entities.GiftList.get(gift_list_id).catch(() => null);
    if (!list || list.subscriber_user_id !== user.id || list.visible_to_subscriber !== true) {
      return Response.json({ error: "Gift list not found" }, { status: 404 });
    }

    // Optional subscriber context for Gem. Stored even when the request short-circuits
    // below (pending dedupe / cooldown / recent auto-reject), so Gem always sees the
    // LATEST reason on the list being refreshed. Untrusted text: hard-capped at 300
    // chars, only ever rendered as escaped text in the admin UI.
    // SCHEMA-GATE (round 3): refresh_reason is repo-only until publish — this write
    // silently drops today and every reader treats absence as normal. No backfill
    // needed: historical refreshes legitimately carry no reason.
    const reason = typeof refresh_reason === "string" ? refresh_reason.trim().slice(0, 300) : "";
    if (reason) {
      await svc.entities.GiftList.update(list.id, { refresh_reason: reason }).catch(() => {});
    }

    const pending = await svc.entities.GiftList.filter({
      recipient_id: list.recipient_id,
      status: "pending_approval",
    });
    if (pending.some((candidate) => candidate.supersedes_list_id === list.id)) {
      return Response.json({ status: "already_requested" });
    }

    // Cooldown: one refresh per list per 24h. A FAILED regeneration leaves no pending
    // superseding list, so without this every click re-runs the whole pipeline (~40 link
    // fetches, image-repair AI calls, LLM calls) and emails Gem again.
    const cooldownCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const lastRequestedAt = list.refresh_requested_at ? new Date(list.refresh_requested_at).getTime() : NaN;
    if (Number.isFinite(lastRequestedAt) && lastRequestedAt > cooldownCutoff) {
      return Response.json({ status: "already_requested" });
    }

    // A superseding list that was auto-rejected within the same window is already queued
    // for Gem's review. Only RECENT ones block: "rejected" is also Gem's manual rejection
    // status and those records persist indefinitely, so an unconditional block would
    // deadlock refresh forever.
    const rejected = await svc.entities.GiftList.filter({
      recipient_id: list.recipient_id,
      status: "rejected",
    });
    const recentlyRejected = rejected.some((candidate) => {
      if (candidate.supersedes_list_id !== list.id) return false;
      const createdAt = candidate.created_date ? new Date(candidate.created_date).getTime() : NaN;
      return Number.isFinite(createdAt) && createdAt > cooldownCutoff;
    });
    if (recentlyRejected) {
      return Response.json({ status: "already_requested" });
    }

    const currentItems = await svc.entities.GiftItem.filter({ gift_list_id: list.id });
    const excludeProductIds = currentItems.map((item) => item.product_id).filter((id) => id && id !== "manual");
    const requestedAt = new Date().toISOString();
    await svc.entities.GiftList.update(list.id, { refresh_requested_at: requestedAt });

    // svc.functions.invoke REJECTS on any non-2xx, so generateGiftList's meaningful 422
    // shortfall body arrives as a rejection, not a resolved response. Recover it from
    // err.response.data so the mapping below still runs instead of the outer catch
    // turning a handled shortfall into a 500 with a raw axios message.
    let result;
    try {
      result = await svc.functions.invoke("generateGiftList", {
        recipient_id: list.recipient_id,
        list_type: list.list_type,
        exclude_product_ids: excludeProductIds,
        supersedes_list_id: list.id,
        internalSecret: Deno.env.get("INTERNAL_FUNCTION_SECRET"),
      });
    } catch (invokeError) {
      const body = invokeError?.response?.data;
      if (!body) throw invokeError; // no callee payload: a genuine transport/runtime failure
      result = { data: body };
    }
    const data = result?.data || result || {};
    if (data.error || data.status !== "pending_approval") {
      return Response.json({ error: data.error || "Fresh suggestions could not be prepared" }, { status: 422 });
    }
    return Response.json({ status: "pending_approval", giftListId: data.giftListId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
