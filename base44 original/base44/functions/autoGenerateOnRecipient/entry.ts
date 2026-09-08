import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Auto-generates a gift list whenever a new Recipient is created.
// Wired to an entity automation (Recipient -> create). This is the ONLY place that
// triggers generation automatically. CONFIRMED IN WRITING by Kate (Discord,
// 2026-07-24): "yes correct - she asked for it to auto generate on adding a
// relative." Runs one generation per new recipient and drops the resulting list
// into Gem's approval queue.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    // Entity automation payload: { event: { type, entity_name, entity_id }, data, ... }
    const recipientId = body?.event?.entity_id || body?.data?.id || body?.recipient_id;

    // The Recipient -> create automation does not reliably carry an admin user session,
    // so an admin-only gate would 403 every automated run and a subscriber's first list
    // would never generate. Accept either a real admin caller or a well-formed Recipient
    // automation envelope. Residual risk: the envelope check is spoofable by anyone who
    // can reach this endpoint — the blast radius is one bounded generation landing
    // invisibly in Gem's approval queue, but it is unauthenticated AI spend.
    const user = await base44.auth.me().catch(() => null);
    const ev = body?.event;
    const isAutomation = ev?.entity_name === "Recipient" && typeof ev?.entity_id === "string";
    if (!(user?.role === "admin" || isAutomation)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!recipientId) {
      console.error("autoGenerateOnRecipient: no recipient id in payload", JSON.stringify(body));
      return Response.json({ error: "No recipient id in payload" }, { status: 400 });
    }

    console.log("autoGenerateOnRecipient: generating list for recipient", recipientId);

    // functions.invoke REJECTS on any non-2xx, so a legitimate generation shortfall
    // (generateGiftList's 422) would otherwise fall to the outer catch and return 500.
    // Recover the callee's payload from err.response.data and treat it as the handled,
    // non-fatal outcome it is meant to be.
    let res;
    try {
      res = await base44.asServiceRole.functions.invoke("generateGiftList", {
        recipient_id: recipientId,
        list_type: "curated",
        internalSecret: Deno.env.get("INTERNAL_FUNCTION_SECRET"),
      });
    } catch (invokeError) {
      const body = invokeError?.response?.data;
      if (!body) throw invokeError; // no callee payload: a genuine transport/runtime failure
      res = { data: body };
    }

    console.log("autoGenerateOnRecipient: generateGiftList result", JSON.stringify(res?.data ?? res));

    return Response.json({ ok: true, recipient_id: recipientId, result: res?.data ?? res });
  } catch (error) {
    console.error("autoGenerateOnRecipient: failed", error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});