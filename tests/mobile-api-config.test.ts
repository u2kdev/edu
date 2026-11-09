import { describe, it, expect } from "vitest";
import { resolveApiBaseUrl } from "../mobile/src/config/api";
import fs from "fs";
import path from "path";

describe("Mobile API URL Configuration & Release Security", () => {
  it("rejects insecure HTTP API URL in release mode", () => {
    expect(() => {
      resolveApiBaseUrl(false, "http://api.edarschi.uz");
    }).toThrow(/Insecure API URL rejected in release build.*Only HTTPS/);
  });

  it("rejects missing API URL in release mode", () => {
    expect(() => {
      resolveApiBaseUrl(false, undefined);
    }).toThrow(/EXPO_PUBLIC_API_URL must be configured for release builds/);
  });

  it("accepts valid HTTPS API URL in release mode", () => {
    const url = resolveApiBaseUrl(false, "https://api.edarschi.uz");
    expect(url).toBe("https://api.edarschi.uz");
  });

  it("trims trailing slashes in release mode", () => {
    const url = resolveApiBaseUrl(false, "https://api.edarschi.uz///");
    expect(url).toBe("https://api.edarschi.uz");
  });

  it("allows local HTTP URL in development mode", () => {
    const url = resolveApiBaseUrl(true, "http://192.168.1.50:3000");
    expect(url).toBe("http://192.168.1.50:3000");
  });

  it("api-client.ts restricts LAN fallback strictly to development environment", () => {
    const clientCode = fs.readFileSync(
      path.resolve(__dirname, "../mobile/src/services/api-client.ts"),
      "utf8"
    );

    expect(clientCode).toContain("isDevelopmentEnvironment()");
    expect(clientCode).toContain("isDevelopmentEnvironment() && !endpoint.startsWith(\"http\")");
  });
});
