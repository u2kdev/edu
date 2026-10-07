import { describe, it, expect } from "vitest";
import { apiError, apiSuccess, handleApiError } from "../src/lib/api-response";
import { z } from "zod";

describe("API Response Utilities", () => {
  it("apiError creates standard error format", async () => {
    const res = apiError("Invalid input", "VALIDATION_ERROR", 400);
    const data = await res.json();
    
    expect(res.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: undefined,
      }
    });
  });

  it("apiSuccess creates standard success format", async () => {
    const res = apiSuccess({ user: "test" }, 201);
    const data = await res.json();
    
    expect(res.status).toBe(201);
    expect(data).toEqual({
      success: true,
      user: "test"
    });
  });

  it("handleApiError handles ZodError", async () => {
    const schema = z.object({ email: z.string().email("invalid_email") });
    
    try {
      schema.parse({ email: "bad" });
    } catch (e) {
      const res = handleApiError(e);
      const data = await res.json();
      
      expect(res.status).toBe(400);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.details[0].message).toBe("invalid_email");
      expect(data.error.details[0].path).toEqual(["email"]);
    }
  });

  it("handleApiError handles standard Error", async () => {
    const e = new Error("Something went wrong");
    const res = handleApiError(e);
    const data = await res.json();
    
    expect(res.status).toBe(500);
    expect(data.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(data.error.message).toBe("Something went wrong");
  });
});
