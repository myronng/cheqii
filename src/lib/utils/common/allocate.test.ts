import { allocate } from '$lib/utils/common/allocate';
import { expect, test } from 'vitest';

import { MOCK_CHEQUE_DATA_COMPLEX, MOCK_CHEQUE_DATA_SIMPLE } from '../../../../tests/mockData';

test('distributes item costs across all contributors', () => {
	expect(allocate(MOCK_CHEQUE_DATA_COMPLEX.contributors, MOCK_CHEQUE_DATA_COMPLEX.items)).toBe({
		contributions: new Map([
			[
				0,
				{
					owing: {
						items: [
							{
								cost: 120,
								name: 'Test item 1',
								split: {
									denominator: 5,
									multiplicand: 600,
									numerator: 1
								}
							},
							{
								cost: 120,
								name: 'Test item 2',
								split: {
									denominator: 3,
									multiplicand: 362,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 3',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							},
							{
								cost: 101,
								name: 'Test item 4',
								split: {
									denominator: 3,
									multiplicand: 303,
									numerator: 1
								}
							},
							{
								cost: 0,
								name: 'Test item 5',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 0
								}
							},
							{
								cost: 200,
								name: 'Test item 6',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 2
								}
							}
						],
						total: 644
					},
					paid: {
						items: [
							{
								cost: 600,
								name: 'Test item 1'
							},
							{
								cost: 403,
								name: 'Test item 3'
							},
							{
								cost: 403,
								name: 'Test item 6'
							}
						],
						total: 1406
					}
				}
			],
			[
				1,
				{
					owing: {
						items: [
							{
								cost: 120,
								name: 'Test item 1',
								split: {
									denominator: 5,
									multiplicand: 600,
									numerator: 1
								}
							},
							{
								cost: 120,
								name: 'Test item 2',
								split: {
									denominator: 3,
									multiplicand: 362,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 3',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							},
							{
								cost: 101,
								name: 'Test item 4',
								split: {
									denominator: 3,
									multiplicand: 303,
									numerator: 1
								}
							},
							{
								cost: 200,
								name: 'Test item 5',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 2
								}
							},
							{
								cost: 0,
								name: 'Test item 6',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 0
								}
							}
						],
						total: 645
					},
					paid: {
						items: [
							{
								cost: 362,
								name: 'Test item 2'
							},
							{
								cost: 303,
								name: 'Test item 4'
							},
							{
								cost: 403,
								name: 'Test item 5'
							}
						],
						total: 1068
					}
				}
			],
			[
				2,
				{
					owing: {
						items: [
							{
								cost: 120,
								name: 'Test item 1',
								split: {
									denominator: 5,
									multiplicand: 600,
									numerator: 1
								}
							},
							{
								cost: 0,
								name: 'Test item 2',
								split: {
									denominator: 3,
									multiplicand: 362,
									numerator: 0
								}
							},
							{
								cost: 100,
								name: 'Test item 3',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							},
							{
								cost: 0,
								name: 'Test item 4',
								split: {
									denominator: 3,
									multiplicand: 303,
									numerator: 0
								}
							},
							{
								cost: 100,
								name: 'Test item 5',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 6',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							}
						],
						total: 420
					},
					paid: {
						items: [],
						total: 0
					}
				}
			],
			[
				3,
				{
					owing: {
						items: [
							{
								cost: 240,
								name: 'Test item 1',
								split: {
									denominator: 5,
									multiplicand: 600,
									numerator: 2
								}
							},
							{
								cost: 120,
								name: 'Test item 2',
								split: {
									denominator: 3,
									multiplicand: 362,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 3',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							},
							{
								cost: 101,
								name: 'Test item 4',
								split: {
									denominator: 3,
									multiplicand: 303,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 5',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 6',
								split: {
									denominator: 4,
									multiplicand: 403,
									numerator: 1
								}
							}
						],
						total: 765
					},
					paid: {
						items: [],
						total: 0
					}
				}
			]
		]),
		grandTotal: 2474,
		owingUnaccounted: 0,
		paidUnaccounted: 0
	});
	expect(allocate(MOCK_CHEQUE_DATA_SIMPLE.contributors, MOCK_CHEQUE_DATA_SIMPLE.items)).toBe( {
		contributions: new Map([
			[
				0,
				{
					owing: {
						items: [
							{
								cost: 100,
								name: 'Test item 1',
								split: {
									denominator: 2,
									multiplicand: 201,
									numerator: 1
								}
							},
							{
								cost: 100,
								name: 'Test item 2',
								split: {
									denominator: 1,
									multiplicand: 100,
									numerator: 1
								}
							}
						],
						total: 201
					},
					paid: {
						items: [
							{
								cost: 201,
								name: 'Test item 1'
							}
						],
						total: 201
					}
				}
			],
			[
				1,
				{
					owing: {
						items: [
							{
								cost: 100,
								name: 'Test item 1',
								split: {
									denominator: 2,
									multiplicand: 201,
									numerator: 1
								}
							},
							{
								cost: 0,
								name: 'Test item 2',
								split: {
									denominator: 1,
									multiplicand: 100,
									numerator: 0
								}
							}
						],
						total: 100
					},
					paid: {
						items: [
							{
								cost: 100,
								name: 'Test item 2'
							}
						],
						total: 100
					}
				}
			]
		]),
		grandTotal: 301,
		owingUnaccounted: 0,
		paidUnaccounted: 0
	});
});

test('handles empty contributors', () => {
	expect(allocate([], MOCK_CHEQUE_DATA_COMPLEX.items)).toBe({
		contributions: new Map(),
		grandTotal: 2474,
		owingUnaccounted: 2474,
		paidUnaccounted: 2474
	});
	expect(allocate([], MOCK_CHEQUE_DATA_SIMPLE.items)).toBe({
		contributions: new Map(),
		grandTotal: 301,
		owingUnaccounted: 301,
		paidUnaccounted: 301
	});
});
