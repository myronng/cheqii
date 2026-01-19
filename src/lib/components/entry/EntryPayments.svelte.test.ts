import { getAppContext } from "$lib/utils/common/context.svelte";
import { getTestStrings } from "$lib/utils/common/locale.test";
import {
  createMockAppContext,
  createMockSupabase,
  MOCK_ALLOCATIONS,
  MOCK_BILL_DATA_COMPLEX,
  MOCK_USER_DATA_COMPLEX,
} from "$lib/utils/common/testMocks";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import EntryPayments from "./EntryPayments.svelte";

vi.mock("$lib/utils/common/context.svelte", () => ({
  getAppContext: vi.fn(),
  setAppContext: vi.fn(),
}));

describe("EntryPayments", () => {
  const mockStrings = getTestStrings();

  let mockAppContext: ReturnType<typeof createMockAppContext>;

  beforeEach(() => {
    mockAppContext = createMockAppContext({
      user: MOCK_USER_DATA_COMPLEX,
      bills: [MOCK_BILL_DATA_COMPLEX],
    });

    (getAppContext as Mock<typeof getAppContext>).mockReturnValue(
      mockAppContext,
    );
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
      allocations: MOCK_ALLOCATIONS,
      billData: billData,
      currencyFormatter: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }),
      strings: mockStrings,
      userId: actualAppUserId,
    });

    const linkButton = screen.getByRole("button", {
      name: "Link payment account to To Be Linked",
    });
    expect(linkButton).toBeInTheDocument();

    await fireEvent.click(linkButton);

    expect(billData.bill_contributors[0].id).toBe(actualAppUserId);
    expect(billData.bill_items[0].contributor_id).toBe(actualAppUserId);
    expect(mockAppContext.bills.update).toHaveBeenCalledWith(billData);
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
      strings: mockStrings,
      userId: aliceId,
    });

    const select = screen.getByTitle(mockStrings.paymentMethod);
    await fireEvent.change(select, { target: { value: "payPal" } });

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ type: "UPDATE_CONTRIBUTOR" }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
    expect(mockAppContext.user.update).toHaveBeenCalledWith({
      default_payment_method: "payPal",
    });
  });

  it("should update payment ID and call update_user_payment_id RPC", async () => {
    const mockSupabase = createMockSupabase();
    const aliceId = "f45081b6-a631-4b83-8098-81ebce287915";

    render(EntryPayments, {
      allocations: MOCK_ALLOCATIONS,
      billData: MOCK_BILL_DATA_COMPLEX,
      currencyFormatter: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }),
      strings: mockStrings,
      userId: aliceId,
    });

    const input = screen.getByPlaceholderText(mockStrings.paymentId);
    await fireEvent.change(input, { target: { value: "new@test.com" } });

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ type: "UPDATE_CONTRIBUTOR" }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
    expect(mockAppContext.user.update).toHaveBeenCalledWith({
      default_payment_id: "new@test.com",
    });
  });
});
