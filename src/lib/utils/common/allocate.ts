import type { Contributor, Item } from '$lib/types/cheque';

import { MaxHeap } from '$lib/utils/common/heap';

export type Allocations = {
	contributions: Map<
		number,
		{
			owing: Allocation<{
				split: {
					denominator: number;
					multiplicand: number;
					numerator: number;
				};
			}>;
			paid: Allocation;
		}
	>;
	grandTotal: number;
	owingUnaccounted: number;
	paidUnaccounted: number;
};

type Allocation<ItemExtras = object> = {
	items: ({
		cost: number;
		name: string;
	} & ItemExtras)[];
	total: number;
};

export function allocate(contributors: Contributor[], items: Item[]): Allocations {
	const contributions: Allocations['contributions'] = new Map();
	for (let i = 0; i < contributors.length; i++) {
		contributions.set(i, {
			owing: { items: [], total: 0 },
			paid: { items: [], total: 0 }
		});
	}

	let grandTotal = 0;
	// Unaccounted values should never occur but if the data is corrupted then this will catch it
	let paidUnaccounted = 0;
	let owingUnaccounted = 0;
	for (const item of items) {
		let splitTotal = 0;
		for (const split of item.split) {
			splitTotal += split;
		}

		if (!item.cost || !splitTotal) {
			continue;
		}
		// This value can be split evenly among applicable contributors
		const balancedSplit = Math.floor(item.cost / splitTotal);
		// This value needs to be split unevenly among applicable contributors
		const imbalancedSplit = item.cost % splitTotal;

		const heap = new MaxHeap();
		for (let i = 0; i < item.split.length; i++) {
			const contributorSplit = item.split[i];
			const owingContributor = contributions.get(i);
			const owing = balancedSplit * contributorSplit;
			if (owingContributor) {
				owingContributor.owing.items.push({
					cost: owing,
					name: item.name,
					split: { denominator: splitTotal, multiplicand: item.cost, numerator: contributorSplit }
				});
				owingContributor.owing.total += owing;
				heap.insert({ index: i, value: owingContributor.owing.total });
			} else {
				owingUnaccounted += owing;
			}
		}

		for (let i = 0; i < imbalancedSplit; i++) {
			const heapNode = heap.extractMax();
			if (heapNode) {
				const contribution = contributions.get(heapNode.index);
				if (contribution) {
					contribution.owing.total = heapNode.value + 1;
				} else {
					owingUnaccounted += 1;
				}
			} else {
				owingUnaccounted += 1;
			}
		}

		const paidContributor = contributions.get(item.buyer);
		if (paidContributor) {
			paidContributor.paid.items.push({ cost: item.cost, name: item.name });
			paidContributor.paid.total += item.cost;
		} else {
			paidUnaccounted += item.cost;
		}
		grandTotal += item.cost;
	}

	return {
		contributions,
		grandTotal,
		owingUnaccounted,
		paidUnaccounted
	};
}
