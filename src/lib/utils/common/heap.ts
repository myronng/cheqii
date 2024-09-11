export type HeapNode = { index: number; value: number };

export class MaxHeap {
	private heap: HeapNode[];

	constructor() {
		this.heap = [];
	}

	private bubbleDown(index: number): void {
		const leftChildIndex = 2 * index + 1;
		const rightChildIndex = 2 * index + 2;
		let largestIndex = index;

		if (
			leftChildIndex < this.heap.length &&
			this.heap[leftChildIndex].value > this.heap[largestIndex].value
		) {
			largestIndex = leftChildIndex;
		}

		if (
			rightChildIndex < this.heap.length &&
			this.heap[rightChildIndex].value > this.heap[largestIndex].value
		) {
			largestIndex = rightChildIndex;
		}

		if (largestIndex !== index) {
			[this.heap[largestIndex], this.heap[index]] = [this.heap[index], this.heap[largestIndex]];
			this.bubbleDown(largestIndex);
		}
	}

	private bubbleUp(index: number): void {
		if (index === 0) return; // Base case: root node has no parent
		const parentIndex = Math.floor((index - 1) / 2);
		if (this.heap[parentIndex].value < this.heap[index].value) {
			[this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
			this.bubbleUp(parentIndex);
		}
	}

	extractMax(): HeapNode | null {
		if (this.heap.length === 0) return null;
		if (this.heap.length === 1) return this.heap.pop()!;

		const max = this.heap[0];
		this.heap[0] = this.heap.pop()!;
		this.bubbleDown(0);
		return max;
	}

	insert(node: HeapNode): void {
		this.heap.push(node);
		this.bubbleUp(this.heap.length - 1);
	}
}
