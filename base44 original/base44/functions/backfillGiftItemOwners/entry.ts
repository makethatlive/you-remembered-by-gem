import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin-only one-off backfill (Phase A3). Copies subscriber_user_id from each GiftList
// down onto its GiftItems so the new GiftItem read rule
// ({"data.subscriber_user_id": "{{user.id}}"}) matches historical rows. Without this,
// every subscriber's existing lists appear EMPTY the moment the GiftItem RLS is published.
//
// Run backfillSubscriberLinks FIRST: this function can only copy an owner id that the
// parent list already has. Lists still missing one are counted and reported, not guessed.
//
// Bounded (one list read, one item read per owned list, bulk writes), no AI, no emails.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden: Admin access required" }, { status: 403 });

    const svc = base44.asServiceRole;
    const lists = await svc.entities.GiftList.list("-created_date", 5000);

    const withOwner = lists.filter((list) => !!list.subscriber_user_id);

    let itemsScanned = 0;
    let itemsUpdated = 0;
    const pending = [];
    const pendingListIds = []; // parallel to `pending`: which list each queued item came from
    // A one-off migration must be completable and re-runnable: a single bad row is skipped
    // and reported here, never allowed to abort the sweep via the outer catch.
    const skippedListIds = new Set();

    // Process lists in concurrent batches of 20 so one slow query cannot stall the run.
    const BATCH = 20;
    for (let i = 0; i < withOwner.length; i += BATCH) {
      const slice = withOwner.slice(i, i + BATCH);
      await Promise.all(slice.map(async (list) => {
        let items;
        try {
          items = await svc.entities.GiftItem.filter({ gift_list_id: list.id });
        } catch (_readError) {
          skippedListIds.add(list.id);
          return;
        }
        items = items || [];
        itemsScanned += items.length;
        for (const item of items) {
          if (!item.subscriber_user_id) {
            pending.push({ id: item.id, subscriber_user_id: list.subscriber_user_id });
            pendingListIds.push(list.id);
          }
        }
      }));
    }

    // Apply updates in bulk (max 500 per call). If a chunk fails, retry it row by row so a
    // single unwritable item costs only itself — the rest of the migration still completes.
    for (let i = 0; i < pending.length; i += 500) {
      const chunk = pending.slice(i, i + 500);
      const chunkListIds = pendingListIds.slice(i, i + 500);
      try {
        await svc.entities.GiftItem.bulkUpdate(chunk);
        itemsUpdated += chunk.length;
      } catch (_bulkError) {
        for (let j = 0; j < chunk.length; j++) {
          try {
            await svc.entities.GiftItem.update(chunk[j].id, {
              subscriber_user_id: chunk[j].subscriber_user_id,
            });
            itemsUpdated++;
          } catch (_itemError) {
            skippedListIds.add(chunkListIds[j]);
          }
        }
      }
    }

    return Response.json({
      lists_scanned: lists.length,
      lists_with_owner: withOwner.length,
      lists_missing_owner: lists.length - withOwner.length,
      items_scanned: itemsScanned,
      items_updated: itemsUpdated,
      items_failed: pending.length - itemsUpdated,
      skipped_lists: skippedListIds.size,
      skipped_list_ids: Array.from(skippedListIds).slice(0, 50),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
