import { goto } from "$app/navigation";
import { getTestStrings } from "$lib/utils/common/locale.test";
import {
  createMockSupabase,
  MOCK_BILL_DATA_COMPLEX,
} from "$lib/utils/common/testMocks";
import { getUser } from "$lib/utils/models/user.svelte";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EntrySettings from "./entrySettings.svelte";

// Mock dependencies
vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
}));

vi.mock("$lib/utils/models/user.svelte", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getUser: vi.fn(),
  };
});

describe("EntrySettings", () => {
  const mockStrings = getTestStrings();
  // Index 1 is Dave (Owner), Index 0 is Alice (Public)
  const mockOwnerId = MOCK_BILL_DATA_COMPLEX.bill_users[1].user_id;
  const mockNonOwnerId = MOCK_BILL_DATA_COMPLEX.bill_users[0].user_id;

  let mockOnBillChange: any;
  let mockOnUserChange: any;
  let mockSupabase: any;

  beforeEach(() => {
    mockOnBillChange = vi.fn();
    mockOnUserChange = vi.fn();
    mockSupabase = createMockSupabase();

    (getUser as any).mockResolvedValue({
      get get() {
        return { bills: [MOCK_BILL_DATA_COMPLEX.id] };
      },
      set: vi.fn(),
    });

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
    onBillChange: vi.fn(),
    onUserChange: vi.fn(),
    strings: mockStrings,
    supabase: {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }),
    } as any,
    url: "https://cheqii.app/bills/123",
    userId: mockOwnerId,
  };

  it("should handle the full settings flow", async () => {
    render(EntrySettings, props);
    const dialog = screen.getByRole("dialog", { hidden: true });
    dialog.setAttribute("open", "");

    // 1. Initial Render
    expect(screen.getByText(mockStrings.settings)).toBeInTheDocument();

    // 2. Toggle Private
    const privateLabel = screen.getByText(mockStrings.private);
    await fireEvent.click(privateLabel);
    expect(props.billData.invite_required).toBe(true);

    // 3. Regenerate Invite Link
    const regenerateButton = screen
      .getByText(/Regenerate invite link/i)
      .closest("button")!;
    await fireEvent.click(regenerateButton);
    expect(props.supabase.from).toHaveBeenCalledWith("bills");

    // 4. Delete Bill
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
      .mockImplementation(() => ({} as any));
    const removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => ({} as any));

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

    // Leave Bill
    const leaveButton = screen.getByText(/Leave bill/i).closest("button")!;
    await fireEvent.click(leaveButton);
    expect(goto).toHaveBeenCalledWith("/");
  });
});
