import { describe, expect, it } from "vitest";
import { formatBackendStatus } from "./backendStatus";

describe("formatBackendStatus", () => {
  it("renders status and orbitarium version", () => {
    expect(
      formatBackendStatus({ status: "ok", orbitarium_version: "2.0.0" }),
    ).toBe("backend ok — orbitarium v2.0.0");
  });
});
