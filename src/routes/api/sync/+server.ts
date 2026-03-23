import type { Mutation } from "$lib/utils/models/types";
import { type RequestHandler, json } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ locals, request }) => {
  const { supabase, safeGetSession } = locals;
  const { user } = await safeGetSession();

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mutations, sync_seq_id } = (await request.json()) as {
    mutations: Mutation[];
    sync_seq_id: number;
  };
  const processedIds: string[] = [];
  for (const mutation of mutations) {
    if (mutation.user_id !== user.id) continue;

    try {
      const rpcName = `sync_${mutation.type.toLowerCase()}` as any;
      await supabase.rpc(rpcName, {
        p_mutation_id: mutation.id,
        p_user_id: user.id,
        p_created_at: mutation.created_at,
        p_bill_id: mutation.entity_id,
        p_payload: mutation.payload || {},
      });
      processedIds.push(mutation.id);
    } catch (err) {
      console.error(`Failed to apply mutation ${mutation.id}:`, err);
    }
  }

  // Fetch new mutations since last sync (including this user's mutations from other devices)
  const { data: newMutations } = await supabase
    .from("mutation_logs")
    .select("*")
    .gt("seq_id", sync_seq_id)
    .order("seq_id", { ascending: true });

  const latestSeqId =
    newMutations && newMutations.length > 0
      ? newMutations[newMutations.length - 1].seq_id
      : sync_seq_id;

  return json({
    processedIds,
    newMutations: newMutations || [],
    latest_sync_seq_id: latestSeqId,
  });
};
