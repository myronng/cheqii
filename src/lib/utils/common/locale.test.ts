import { describe, expect, it, vi } from "vitest";
import {
  type AcceptedLocale,
  getLocaleStrings,
  interpolateString,
  isAcceptedLocale,
  isValidLocale,
  LOCALE_MASTER,
} from "./locale";

/**
 * Helper for testing components that need localized strings.
 * Pulls directly from the flattened LOCALE_MASTER.
 */
export const getTestStrings = (locale: AcceptedLocale = "en-CA") => {
  return LOCALE_MASTER[locale];
};

describe("locale utility", () => {
  describe("interpolateString", () => {
    it("should interpolate single values", () => {
      const result = interpolateString("Hello {name}!", { name: "Alice" });
      expect(result).toBe("Hello Alice!");
    });

    it("should interpolate multiple values", () => {
      const result = interpolateString("{greeting}, {name}!", {
        greeting: "Hi",
        name: "Bob",
      });
      expect(result).toBe("Hi, Bob!");
    });

    it("should return @placeholder@ for missing keys", () => {
      const result = interpolateString("Hello {name}!", {});
      expect(result).toBe("Hello @{name}@!");
    });

    it("should use formatFn if provided", () => {
      const formatFn = (val: string) => val.toUpperCase();
      const result = interpolateString(
        "Hello {name}!",
        { name: "Alice" },
        formatFn
      );
      expect(result).toBe("Hello ALICE!");
    });

    it("should handle null/undefined strings gracefully", () => {
      expect(interpolateString(null as any, {})).toBeUndefined();
    });
  });

  describe("isAcceptedLocale", () => {
    it("should return true for valid locales", () => {
      expect(isAcceptedLocale("en-CA")).toBe(true);
    });

    it("should return false for invalid locales", () => {
      expect(isAcceptedLocale("fr-FR")).toBe(false);
      expect(isAcceptedLocale(undefined)).toBe(false);
    });
  });

  describe("isValidLocale (string key)", () => {
    it("should return true for existing keys in localeStrings.json", () => {
      expect(isValidLocale("appName")).toBe(true);
      expect(isValidLocale("paymentMethod")).toBe(true);
    });

    it("should return false for non-existent keys", () => {
      expect(isValidLocale("nonExistentKey")).toBe(false);
    });
  });

  describe("getLocaleStrings", () => {
    const mockCookies = {
      get: vi.fn(),
      set: vi.fn(),
    } as any;

    const mockRequest = {
      headers: {
        get: vi.fn(),
      },
    } as any;

    it("should return correct strings for a given subset", () => {
      mockCookies.get.mockReturnValue("en-CA");

      const result = getLocaleStrings(mockCookies, mockRequest, ["appName"]);

      expect(result.locale).toBe("en-CA");
      expect(result.strings.appName).toBe("Cheqii");
    });

    it("should fall back to DEFAULT_LOCALE if cookie is invalid", () => {
      mockCookies.get.mockReturnValue("invalid");
      mockRequest.headers.get.mockReturnValue(null);

      const result = getLocaleStrings(mockCookies, mockRequest, ["appName"]);

      expect(result.locale).toBe("en-CA");
      expect(mockCookies.set).toHaveBeenCalledWith("locale", "en-CA", {
        path: "/",
      });
    });

    it("should throw error if an invalid string key is requested", () => {
      mockCookies.get.mockReturnValue("en-CA");

      expect(() => {
        getLocaleStrings(mockCookies, mockRequest, ["invalidKey" as any]);
      }).toThrow("missingLocaleString");
    });
  });
});
