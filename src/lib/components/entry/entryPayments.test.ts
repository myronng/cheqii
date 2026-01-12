import { getTestStrings } from "$lib/utils/common/locale.test";
import {
  createMockSupabase,
  MOCK_ALLOCATIONS,
  MOCK_BILL_DATA_COMPLEX,
} from "$lib/utils/common/testMocks";
import * as UserModule from "$lib/utils/models/user.svelte"; // Import for mocking
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EntryPayments from "./entryPayments.svelte";

// Mock the getUser function
vi.mock("$lib/utils/models/user.svelte", async (importOriginal) => {
  const actual = await importOriginal<typeof UserModule>();
  return {
    ...actual,
    getUser: vi.fn(),
  };
});

describe("EntryPayments", () => {
  const mockStrings = getTestStrings();

  let mockOnBillChange: any;
  let mockOnUserChange: any;

  beforeEach(() => {
    mockOnBillChange = vi.fn();
    mockOnUserChange = vi.fn();

    // Mock getUser implementation
    (UserModule.getUser as any).mockResolvedValue({
      get: {
        id: "f45081b6-a631-4b83-8098-81ebce287915", // Alice
        default_payment_id: "default@test.com",
        default_payment_method: "etransfer",
      },
      set: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should update contributor and items when 'Link Payment Account' is clicked", async () => {
    const actualAppUserId = "actual-app-user-id";
    const billData = JSON.parse(JSON.stringify(MOCK_BILL_DATA_COMPLEX));

    // Mock user not in contributors
    billData.bill_contributors[0] = {
      id: "some-random-id",
      bill_id: billData.id,
      name: "To Be Linked",
      sort: 0,
      updated_at: new Date().toISOString(),
    };
    billData.bill_items[0].contributor_id = "some-random-id";

    render(EntryPayments, {
      allocations: MOCK_ALLOCATIONS as any,
      billData: billData,
      currencyFormatter: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }),
      onBillChange: mockOnBillChange,
      onUserChange: mockOnUserChange,
      strings: mockStrings,
      supabase: createMockSupabase() as any,
      userId: actualAppUserId,
    });

    const linkButton = screen.getByRole("button", {
      name: "Link payment account to To Be Linked",
    });
    expect(linkButton).toBeInTheDocument();

    await fireEvent.click(linkButton);

    expect(billData.bill_contributors[0].id).toBe(actualAppUserId);
    expect(billData.bill_items[0].contributor_id).toBe(actualAppUserId);
    expect(mockOnBillChange).toHaveBeenCalledWith(billData);
  });

  it("should update payment method and call update_user_payment_method RPC", async () => {
    const mockSupabase = createMockSupabase();
    const aliceId = "f45081b6-a631-4b83-8098-81ebce287915";

    render(EntryPayments, {
      allocations: MOCK_ALLOCATIONS as any,
      billData: MOCK_BILL_DATA_COMPLEX,
      currencyFormatter: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }),
      onBillChange: mockOnBillChange,
      onUserChange: mockOnUserChange,
      strings: mockStrings,
      supabase: mockSupabase as any,
      userId: aliceId,
    });

    const select = screen.getByTitle(mockStrings.paymentMethod);
    await fireEvent.change(select, { target: { value: "payPal" } });

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "update_user_payment_method",
      {
        p_bill_id: MOCK_BILL_DATA_COMPLEX.id,
        p_user_id: aliceId,
        p_payment_method: "payPal",
      }
    );
    expect(mockOnBillChange).toHaveBeenCalled();
    expect(mockOnUserChange).toHaveBeenCalledWith({
      default_payment_method: "payPal",
    });
  });

  it("should update payment ID and call update_user_payment_id RPC", async () => {
    const mockSupabase = createMockSupabase();
    const aliceId = "f45081b6-a631-4b83-8098-81ebce287915";

    render(EntryPayments, {
      allocations: MOCK_ALLOCATIONS as any,
      billData: MOCK_BILL_DATA_COMPLEX,
      currencyFormatter: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }),
      onBillChange: mockOnBillChange,
      onUserChange: mockOnUserChange,
      strings: mockStrings,
      supabase: mockSupabase as any,
      userId: aliceId,
    });

    const input = screen.getByPlaceholderText(mockStrings.paymentId);
    await fireEvent.change(input, { target: { value: "new@test.com" } });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("update_user_payment_id", {
      p_bill_id: MOCK_BILL_DATA_COMPLEX.id,
      p_user_id: aliceId,
      p_payment_id: "new@test.com",
    });
    expect(mockOnBillChange).toHaveBeenCalled();
    expect(mockOnUserChange).toHaveBeenCalledWith({
      default_payment_id: "new@test.com",
    });
  });
});
