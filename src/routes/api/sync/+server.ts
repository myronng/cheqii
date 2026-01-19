import { type BillData } from "$lib/utils/models/bill.svelte";
import type { Mutation } from "$lib/utils/models/sync.svelte";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type RequestHandler, json } from "@sveltejs/kit";

export const POST: RequestHandler = async ({ locals, request }) => {
  const { supabase, safeGetSession } = locals;
  const { user } = await safeGetSession();

  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { mutations } = (await request.json()) as {
    mutations: Mutation[];
  };
  const processedIds: string[] = [];

  for (const mutation of mutations) {
    // Check if mutation already executed
    const { data: existing } = await supabase
      .from("mutation_logs")
      .select("id")
      .eq("id", mutation.id)
      .single();

    if (existing) {
      processedIds.push(mutation.id);
      continue;
    }

    // Apply mutation logic
    try {
      if (mutation.user_id !== user.id) {
        // Security check: Mutation user must match auth user
        console.warn("Mutation user mismatch", mutation.id);
        continue;
      }

      await applyMutation(supabase, mutation);

      // Log success
      await supabase.from("mutation_logs").insert({
        id: mutation.id,
        entity_id: mutation.entity_id,
        mutation_type: mutation.type,
        payload: mutation.payload,
        user_id: user.id,
      });

      processedIds.push(mutation.id);
    } catch (err) {
      console.error(`Failed to apply mutation ${mutation.id}:`, err);
    }
  }

  return json({ processedIds });
};

async function applyMutation(supabase: SupabaseClient, mutation: Mutation) {
  const { type, payload } = mutation;

  switch (type) {
    case "CREATE_BILL":
      await supabase.rpc("create_full_bill", {
        p_bill_data: payload.bill,
        p_owner_uuid: mutation.user_id,
      });
      break;

    case "UPDATE_BILL":
      const updateBillData: Partial<BillData> = {};
      if (payload.name !== undefined) updateBillData.name = payload.name;
      if (payload.invite_id !== undefined)
        updateBillData.invite_id = payload.invite_id;
      if (payload.invite_required !== undefined)
        updateBillData.invite_required = payload.invite_required;

      if (Object.keys(updateBillData).length > 0) {
        await supabase
          .from("bills")
          .update(updateBillData)
          .eq("id", mutation.entity_id);
      }
      break;

    case "DELETE_BILL":
      await supabase.from("bills").delete().eq("id", mutation.entity_id);
      break;

    case "ADD_ITEM":
      await supabase.rpc("create_bill_item", {
        p_item: payload.item,
        p_splits: payload.splits,
      });
      break;

    case "UPDATE_ITEM":
      // payload: { id, name?, cost?, contributor_id? }
      const updateItemData: Partial<BillData["bill_items"][0]> = {};
      if (payload.name !== undefined) updateItemData.name = payload.name;
      if (payload.cost !== undefined) updateItemData.cost = payload.cost;
      if (payload.contributor_id !== undefined)
        updateItemData.contributor_id = payload.contributor_id;

      if (Object.keys(updateItemData).length > 0) {
        await supabase
          .from("bill_items")
          .update(updateItemData)
          .eq("id", payload.id);
      }
      break;

    case "DELETE_ITEM":
      await supabase.rpc("delete_bill_item", { p_item_id: payload.id });
      break;

    case "ADD_CONTRIBUTOR":
      await supabase.rpc("create_bill_contributor", {
        p_contributor: payload.contributor,
        p_splits: payload.splits,
      });
      break;

    case "UPDATE_CONTRIBUTOR":
      if (payload.new_user_id) {
        // Link Account
        await supabase.rpc("link_contributor_account", {
          p_bill_id: mutation.entity_id,
          p_old_contributor_id: payload.id,
          p_new_user_id: payload.new_user_id,
        });
      } else if (payload.is_bill_user) {
        // Update bill_users payment method
        const updateData: any = {};
        if (payload.paymentId !== undefined)
          updateData.payment_id = payload.paymentId;
        if (payload.paymentMethod !== undefined)
          updateData.payment_method = payload.paymentMethod;

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from("bill_users")
            .update(updateData)
            .eq("bill_id", mutation.entity_id)
            .eq("user_id", payload.userId);
        }
      } else {
        await supabase
          .from("bill_contributors")
          .update({ name: payload.name })
          .eq("id", payload.id);
      }
      break;

    case "DELETE_CONTRIBUTOR":
      await supabase.rpc("delete_bill_contributor", {
        p_contributor_id: payload.contributorId,
        p_reassign_to_id: payload.reassignToId,
      });
      break;

    case "UPDATE_SPLIT":
      await supabase
        .from("bill_item_splits")
        .update({ ratio: payload.ratio })
        .eq("id", payload.id);
      break;
    case "LEAVE_BILL":
      await supabase
        .from("bill_users")
        .delete()
        .eq("bill_id", mutation.entity_id)
        .eq("user_id", mutation.user_id);
      break;
    case "UPDATE_USER":
      await supabase.from("users").update(payload).eq("id", mutation.entity_id);
      break;
  }
}
