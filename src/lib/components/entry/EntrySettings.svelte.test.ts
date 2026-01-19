import { goto } from "$app/navigation";
import { getAppContext } from "$lib/utils/common/context.svelte";
import { getTestStrings } from "$lib/utils/common/locale.test";
import {
  createMockAppContext,
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
import EntrySettings from "./EntrySettings.svelte";

// Mock dependencies
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

vi.mock("$lib/utils/common/context.svelte", () => ({
  getAppContext: vi.fn(),
  setAppContext: vi.fn(),
}));

describe("EntrySettings", () => {
  const mockStrings = getTestStrings();
  const mockOwnerId = MOCK_BILL_DATA_COMPLEX.bill_users[1].user_id;
  const mockNonOwnerId = MOCK_BILL_DATA_COMPLEX.bill_users[0].user_id;

  let mockAppContext: ReturnType<typeof createMockAppContext>;

  beforeEach(() => {
    mockAppContext = createMockAppContext({
      user: MOCK_USER_DATA_COMPLEX,
      bills: [MOCK_BILL_DATA_COMPLEX],
    });

    (getAppContext as Mock<typeof getAppContext>).mockReturnValue(
      mockAppContext,
    );

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const props = {
    billData: JSON.parse(JSON.stringify(MOCK_BILL_DATA_COMPLEX)),
    currencyFactor: 1,
    strings: mockStrings,
    url: "https://cheqii.app/bills/123",
    userId: mockOwnerId,
  };

  it("should handle the full settings flow", async () => {
    render(EntrySettings, props);
    const dialog = screen.getByRole("dialog", { hidden: true });
    dialog.setAttribute("open", "");

    expect(screen.getByText(mockStrings.settings)).toBeInTheDocument();

    const privateLabel = screen.getByText(mockStrings.private);
    await fireEvent.click(privateLabel);
    expect(props.billData.invite_required).toBe(true);

    const regenerateButton = screen
      .getByText(/Regenerate invite link/i)
      .closest("button")!;
    await fireEvent.click(regenerateButton);
    expect(mockAppContext.bills.update).toHaveBeenCalled();

    const deleteButton = screen.getByText(/Delete bill/i).closest("button")!;
    await fireEvent.click(deleteButton);
    expect(goto).toHaveBeenCalledWith("/");
  });

  it("should trigger CSV download", async () => {
    render(EntrySettings, props);

    const downloadButton = screen
      .getByText(mockStrings.downloadCsv)
      .closest("button")!;
    const mockLink = { click: vi.fn(), download: "", href: "" };

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName) => {
        if (tagName === "a") return mockLink as any;
        return originalCreateElement(tagName);
      });

    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => ({}) as any);
    const removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => ({}) as any);

    await fireEvent.click(downloadButton);
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockLink.click).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("should handle non-owner leave flow", async () => {
    const nonOwnerProps = {
      ...props,
      userId: mockNonOwnerId,
    };
    render(EntrySettings, nonOwnerProps);
    const dialog = screen.getByRole("dialog", { hidden: true });
    dialog.setAttribute("open", "");

    const leaveButton = screen.getByText(/Leave bill/i).closest("button")!;
    await fireEvent.click(leaveButton);
    expect(goto).toHaveBeenCalledWith("/");
  });
});
