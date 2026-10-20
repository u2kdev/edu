import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendEmail,
  renderEmailTemplate,
  getSentEmails,
  clearSentEmails,
  EmailDeliveryError,
} from "../src/lib/email";

describe("Email Transport and Templates (Block 6.2c)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearSentEmails();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe("Templates (ru & uz)", () => {
    it("renders EMAIL_CONFIRMATION in Russian and Uzbek", () => {
      const ru = renderEmailTemplate("EMAIL_CONFIRMATION", {
        lang: "ru",
        url: "https://e-darschi.uz/confirm?token=123",
        fullName: "Азиз Рахимов",
      });
      expect(ru.subject).toContain("Подтверждение");
      expect(ru.text).toContain("https://e-darschi.uz/confirm?token=123");
      expect(ru.html).toContain("https://e-darschi.uz/confirm?token=123");
      expect(ru.html).toContain("Азиз Рахимов");

      const uz = renderEmailTemplate("EMAIL_CONFIRMATION", {
        lang: "uz",
        url: "https://e-darschi.uz/confirm?token=123",
        fullName: "Aziz Rahimov",
      });
      expect(uz.subject.toLowerCase()).toContain("tasdiqlash");
      expect(uz.text).toContain("https://e-darschi.uz/confirm?token=123");
      expect(uz.html).toContain("https://e-darschi.uz/confirm?token=123");
      expect(uz.html).toContain("Aziz Rahimov");
    });

    it("renders PASSWORD_RESET in Russian and Uzbek", () => {
      const ru = renderEmailTemplate("PASSWORD_RESET", {
        lang: "ru",
        url: "https://e-darschi.uz/reset?token=xyz",
      });
      expect(ru.subject).toContain("Сброс пароля");
      expect(ru.text).toContain("https://e-darschi.uz/reset?token=xyz");

      const uz = renderEmailTemplate("PASSWORD_RESET", {
        lang: "uz",
        url: "https://e-darschi.uz/reset?token=xyz",
      });
      expect(uz.subject).toContain("Parolni tiklash");
      expect(uz.text).toContain("https://e-darschi.uz/reset?token=xyz");
    });

    it("renders INVITE_LINK in Russian and Uzbek with center name", () => {
      const ru = renderEmailTemplate("INVITE_LINK", {
        lang: "ru",
        url: "https://e-darschi.uz/invite?code=ABC",
        centerName: "Tashkent Academy",
      });
      expect(ru.subject).toContain("Tashkent Academy");
      expect(ru.text).toContain("https://e-darschi.uz/invite?code=ABC");

      const uz = renderEmailTemplate("INVITE_LINK", {
        lang: "uz",
        url: "https://e-darschi.uz/invite?code=ABC",
        centerName: "Tashkent Academy",
      });
      expect(uz.subject).toContain("Tashkent Academy");
      expect(uz.text).toContain("taklif");
    });
  });

  describe("Memory Driver", () => {
    it("buffers sent emails without external network calls", async () => {
      process.env.EMAIL_PROVIDER = "memory";
      await sendEmail("student@test.com", "Test Subject", "Test Body");

      const emails = getSentEmails();
      expect(emails.length).toBe(1);
      expect(emails[0].to).toBe("student@test.com");
      expect(emails[0].subject).toBe("Test Subject");
      expect(emails[0].body).toBe("Test Body");
    });
  });

  describe("Resend Driver", () => {
    it("dispatches HTTP POST to Resend API with correct headers and payload", async () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_mock_123456";
      process.env.EMAIL_FROM = "e-darschi <noreply@e-darschi.uz>";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "email_resend_999" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await sendEmail("user@example.com", "Hello Subject", "Hello Plain Body", "<p>Hello HTML</p>");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(init.method).toBe("POST");
      expect(init.headers["Authorization"]).toBe("Bearer re_test_mock_123456");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const parsedPayload = JSON.parse(init.body as string);
      expect(parsedPayload.to).toEqual(["user@example.com"]);
      expect(parsedPayload.subject).toBe("Hello Subject");
      expect(parsedPayload.from).toBe("e-darschi <noreply@e-darschi.uz>");
      expect(parsedPayload.text).toBe("Hello Plain Body");
      expect(parsedPayload.html).toBe("<p>Hello HTML</p>");
    });

    it("throws EmailDeliveryError on Resend API error response", async () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_invalid_key";

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "API key is invalid", name: "validation_error" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        sendEmail("fail@test.com", "Subject", "Body")
      ).rejects.toThrow(EmailDeliveryError);
    });

    it("throws configuration error if RESEND_API_KEY is missing when provider is resend", async () => {
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;

      await expect(
        sendEmail("fail@test.com", "Subject", "Body")
      ).rejects.toThrow(/RESEND_API_KEY is not configured/);
    });
  });
});
