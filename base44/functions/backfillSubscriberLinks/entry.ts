import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only one-off backfill (B6.1). Repairs GiftLists created before the subscriber
// linkage fix that carry NO subscriber_user_id — those lists, and their items, are
// invisible to the subscriber they belong to (the read rules match on that field).
//
// For each such list the owner is re-resolved from the list's Subscriber email via the
// User entity. `User.filter` on the built-in User entity from a service-role context is
// NOT a proven pattern in this repo, so it is attempted defensively and falls back to the
// proven bounded `User.list` (UsersTab.jsx:12) matched on email in code. We do NOT
// trust the Subscriber's created_by_id here: on webhook-created rows it is the service
// context, not the paying user, which is the exact bug this backfill repairs.
//
// The resolved id is stamped on the list and on its GiftItems (Phase A3). Run this BEFORE
// backfillGiftItemOwners. Bounded (lookups cached per subscriber and per email), no AI,
// no emails. Megan runs it ONCE.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });

    const svc = base44.asServiceRole;
    const lists = await svc.entities.GiftList.list("-created_date", 5000);
    const orphaned = lists.filter((list) => !list.subscriber_user_id);

    const subscriberCache = new Map(); // subscriber_id -> subscriber record or null
    const userIdByEmail = new Map(); // lowercased email -> auth user id or null

    const resolveSubscriber = async (subscriberId) => {
      if (!subscriberId) return null;
      if (subscriberCache.has(subscriberId)) return subscriberCache.get(subscriberId);
      const subscriber = await svc.entities.Subscriber.get(subscriberId).catch(() => null);
      subscriberCache.set(subscriberId, subscriber);
      return subscriber;
    };

    // Fallback directory: one bounded User.list for the whole run, loaded lazily and only
    // if the filter path fails to produce a match. This is the pattern proven in this repo.
    let allUsersPromise = null;
    const loadAllUsers = () => {
      if (!allUsersPromise) {
        allUsersPromise = svc.entities.User.list("-created_date", 5000).catch(() => []);
      }
      return allUsersPromise;
    };

    const resolveUserId = async (email) => {
      if (!email) return null;
      if (userIdByEmail.has(email)) return userIdByEmail.get(email);
      // Preferred path: server-side filter. Unproven for the built-in User entity from a
      // service-role context, so it must never throw the request — on error OR on an empty
      // result we fall back to the bounded list and match the email in code.
      const filtered = await svc.entities.User.filter({ email }).catch(() => null);
      let userId = (filtered || [])[0]?.id || null;
      if (!userId) {
        const allUsers = await loadAllUsers();
        const match = (allUsers || []).find(
          (u) => String(u?.email || "").trim().toLowerCase() === email
        );
        userId = match?.id || null;
      }
      userIdByEmail.set(email, userId);
      return userId;
    };

    let listsUpdated = 0;
    let itemsUpdated = 0;
    let unresolvedCount = 0;
    const unresolvedListIds = [];
    // A one-off migration must be completable and re-runnable: a list that fails to write is
    // skipped and reported, never allowed to abort the sweep via the outer catch.
    const skippedListIds = [];
    let skippedCount = 0;

    for (const list of orphaned) {
      const subscriber = await resolveSubscriber(list.subscriber_id);
      const email = String(subscriber?.email || "").trim().toLowerCase();
      const subscriberUserId = await resolveUserId(email);
      if (!subscriberUserId) {
        // No auth user has signed in under this subscriber's email yet — nothing to link.
        // Reported so Gem can see which lists remain orphaned; never guessed at.
        unresolvedCount++;
        if (unresolvedListIds.length < 50) unresolvedListIds.push(list.id);
        continue;
      }

      try {
        await svc.entities.GiftList.update(list.id, { subscriber_user_id: subscriberUserId });
        listsUpdated++;

        const items = await svc.entities.GiftItem.filter({ gift_list_id: list.id }).catch(() => []);
        const pending = (items || [])
          .filter((item) => item.subscriber_user_id !== subscriberUserId)
          .map((item) => ({ id: item.id, subscriber_user_id: subscriberUserId }));
        // Apply updates in bulk (max 500 per call).
        for (let i = 0; i < pending.length; i += 500) {
          await svc.entities.GiftItem.bulkUpdate(pending.slice(i, i + 500));
        }
        itemsUpdated += pending.length;
      } catch (_listError) {
        skippedCount++;
        if (skippedListIds.length < 50) skippedListIds.push(list.id);
      }
    }

    return Response.json({
      lists_scanned: lists.length,
      lists_missing_owner: orphaned.length,
      lists_updated: listsUpdated,
      items_updated: itemsUpdated,
      unresolved_lists: unresolvedCount,
      unresolved_list_ids: unresolvedListIds,
      skipped_lists: skippedCount,
      skipped_list_ids: skippedListIds,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
