import EntryGrid from "$lib/components/entry/EntryGrid.svelte";
import { getAppContext } from "$lib/utils/common/context.svelte";
import { interpolateString } from "$lib/utils/common/locale";
import { getTestStrings } from "$lib/utils/common/locale.test";
import {
  createMockAppContext,
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

vi.mock("$lib/utils/common/context.svelte", () => ({
  getAppContext: vi.fn(),
  setAppContext: vi.fn(),
}));

describe("EntryGrid", () => {
  const mockStrings = getTestStrings();
  const mockOwnerId = MOCK_BILL_DATA_COMPLEX.bill_users[0].user_id;

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

  const getProps = () => ({
    allocations: MOCK_ALLOCATIONS,
    billData: JSON.parse(JSON.stringify(MOCK_BILL_DATA_COMPLEX)),
    contributorSummaryIndex: -1,
    currencyFactor: 1,
    currencyFormatter: new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }),
    strings: mockStrings,
    userId: mockOwnerId,
  });

  it("should render initial data correctly", () => {
    render(EntryGrid, getProps());

    // Check items
    MOCK_BILL_DATA_COMPLEX.bill_items.forEach((item, index) => {
      const title = interpolateString(mockStrings["item{index}"], {
        index: (index + 1).toString(),
      });
      expect(screen.getByTitle(title)).toHaveValue(item.name);
    });

    // Check contributors
    MOCK_BILL_DATA_COMPLEX.bill_contributors.forEach((contributor, index) => {
      const title = interpolateString(mockStrings["contributor{index}"], {
        index: (index + 1).toString(),
      });
      expect(screen.getByTitle(title)).toHaveValue(contributor.name);
    });
  });

  it("should call create_bill_item RPC when 'Add Item' is clicked", async () => {
    render(EntryGrid, getProps());

    const addButton = screen.getByText(mockStrings.addItem);
    await fireEvent.click(addButton);

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ADD_ITEM" }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });

  it("should call create_bill_contributor RPC when 'Add Contributor' is clicked", async () => {
    render(EntryGrid, getProps());

    const addButton = screen.getByText(mockStrings.addContributor);
    await fireEvent.click(addButton);

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ADD_CONTRIBUTOR" }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });

  it("should update item name and call upsert", async () => {
    const props = getProps();
    render(EntryGrid, props);

    const title = interpolateString(mockStrings["item{index}"], { index: "1" });
    const input = screen.getByTitle(title);

    await fireEvent.input(input, { target: { value: "New Item Name" } });
    await fireEvent.change(input);

    expect(mockAppContext.sync.push).toHaveBeenCalled();
    expect(mockAppContext.bills.update).toHaveBeenCalled();
    expect(props.billData.bill_items[0].name).toBe("New Item Name");
  });

  it("should update item cost and call upsert", async () => {
    const props = getProps();
    render(EntryGrid, props);

    const title = interpolateString(mockStrings["{item}Cost"], {
      item: MOCK_BILL_DATA_COMPLEX.bill_items[0].name,
    });
    const costInput = screen.getByTitle(title);

    await fireEvent.input(costInput, { target: { value: "10" } });
    await fireEvent.change(costInput);

    expect(mockAppContext.sync.push).toHaveBeenCalled();
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });

  it("should update item buyer and call upsert", async () => {
    render(EntryGrid, getProps());

    const title = interpolateString(mockStrings["{item}Buyer"], {
      item: MOCK_BILL_DATA_COMPLEX.bill_items[0].name,
    });
    const buyerSelect = screen.getByTitle(title);

    const newBuyerId = MOCK_BILL_DATA_COMPLEX.bill_contributors[1].id;
    await fireEvent.change(buyerSelect, { target: { value: newBuyerId } });

    expect(mockAppContext.sync.push).toHaveBeenCalled();
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });

  it("should update split ratio and call upsert", async () => {
    const props = getProps();
    render(EntryGrid, props);

    const title = interpolateString(
      mockStrings["{item}ContributionFrom{contributor}"],
      {
        contributor: MOCK_BILL_DATA_COMPLEX.bill_contributors[0].name,
        item: MOCK_BILL_DATA_COMPLEX.bill_items[0].name,
      },
    );
    const splitInput = screen.getByTitle(title);

    await fireEvent.input(splitInput, { target: { value: "50" } });
    await fireEvent.change(splitInput);

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UPDATE_SPLIT",
        payload: {
          id: MOCK_BILL_DATA_COMPLEX.bill_items[0].bill_item_splits[0].id,
          ratio: 50,
        },
        entity_id: MOCK_BILL_DATA_COMPLEX.id,
      }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });

  it("should remove item when remove button is clicked", async () => {
    render(EntryGrid, getProps());

    // To reveal remove button, we must focus an item cell first
    const title = interpolateString(mockStrings["item{index}"], { index: "1" });
    const firstItemInput = screen.getByTitle(title);
    await fireEvent.focus(firstItemInput);

    // Now look for remove button
    const removeLabel = interpolateString(mockStrings["remove{item}"], {
      item: MOCK_BILL_DATA_COMPLEX.bill_items[0].name,
    });
    const removeButton = screen.getByText(removeLabel);
    await fireEvent.click(removeButton);

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DELETE_ITEM" }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });

  it("should remove contributor when remove user button is clicked", async () => {
    render(EntryGrid, getProps());

    // Focus contributor name to set y=0 and x=3+index
    const title = interpolateString(mockStrings["contributor{index}"], {
      index: "1",
    });
    const firstContributorInput = screen.getByTitle(title);
    await fireEvent.focus(firstContributorInput);

    // Now look for remove button
    const removeLabel = interpolateString(mockStrings["remove{item}"], {
      item: MOCK_BILL_DATA_COMPLEX.bill_contributors[0].name,
    });
    const removeButton = screen.getByText(removeLabel);
    await fireEvent.click(removeButton);

    expect(mockAppContext.sync.push).toHaveBeenCalledWith(
      expect.objectContaining({ type: "DELETE_CONTRIBUTOR" }),
    );
    expect(mockAppContext.bills.update).toHaveBeenCalled();
  });
});
