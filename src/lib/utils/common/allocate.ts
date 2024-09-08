import type { Contributor, Item } from '$lib/types/cheque';

import { MaxHeap } from '$lib/utils/common/heap';

export function allocate(items: Item[], contributors: Contributor[]) {
	const contributions = new Map<number, { owing: number; paid: number }>();
	for (let i = 0; i < contributors.length; i++) {
		contributions.set(i, {
			owing: 0,
			paid: 0
		});
	}

	let grandTotal = 0;
	// Unaccounted values should never occur but if the data is corrupted then this will catch it
	let paidUnaccounted = 0;
	let owingUnaccounted = 0;
	for (const item of items) {
		// This value can be split evenly among applicable contributors
		const balancedSplit = Math.floor(item.cost / item.split.total);
		// This value needs to be split unevenly among applicable contributors
		const imbalancedSplit = item.cost % item.split.total;

		const heap = new MaxHeap();
		for (let i = 0; i < item.split.contributors.length; i++) {
			const contributorSplit = item.split.contributors[i];
			const owingContributor = contributions.get(i);
			const owing = balancedSplit * contributorSplit;
			if (owingContributor) {
				owingContributor.owing += owing;
				heap.insert({ index: i, value: owingContributor.owing });
			} else {
				owingUnaccounted += owing;
			}
		}

		for (let i = 0; i < imbalancedSplit; i++) {
			const heapNode = heap.extractMax();
			if (heapNode) {
				const contribution = contributions.get(heapNode.index);
				if (contribution) {
					contribution.owing = heapNode.value + 1;
				} else {
					owingUnaccounted += 1;
				}
			} else {
				owingUnaccounted += 1;
			}
		}

		const paidContributor = contributions.get(item.buyer);
		if (paidContributor) {
			paidContributor.paid += item.cost;
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
