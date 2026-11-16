import { z } from "zod";
import { validatePasswordPolicy } from "@/lib/password-policy";

export const loginSchema = z
  .object({
    email: z
      .string()
      .email("auth.email.invalid")
      .optional()
      .or(z.literal("")),
    login: z.string().optional(),
    password: z.string().min(6, "auth.password.min_6"),
    rememberMe: z.boolean().optional().default(false),
    twoFactorCode: z.string().optional(),
  })
  .refine((data) => !!(data.login || data.email), {
    message: "auth.login.required",
    path: ["login"],
  });

export const mobileLoginSchema = z
  .object({
    email: z.string().optional(),
    login: z.string().optional(),
    password: z.string().min(6, "auth.password.min_6"),
    twoFactorCode: z.string().optional(),
    deviceName: z.string().optional(),
    deviceId: z.string().optional(),
    platform: z.enum(["ios", "android", "web"]).optional(),
  })
  .refine((data) => !!(data.login || data.email), {
    message: "auth.login.required",
    path: ["login"],
  });

export const mobileRefreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "auth.token.required"),
  deviceId: z.string().optional(),
});

export const passwordPolicy = z
  .string()
  .min(10, "auth.password.min_10")
  .max(128, "auth.password.max_128")
  .refine((pwd: string) => validatePasswordPolicy(pwd).valid, {
    message: "auth.password.weak",
  });

export const registerSchema = z
  .object({
    email: z.string().email("auth.email.invalid"),
    password: passwordPolicy,
    fullName: z.string().min(2, "auth.fullName.min_2").max(100, "auth.fullName.max_100"),
    phone: z.string().optional(),
    inviteCode: z.string().min(3),
    locale: z.enum(["ru", "uz"]).optional(),
    lang: z.enum(["ru", "uz"]).optional(),
  })
  .refine(
    (data) =>
      validatePasswordPolicy(data.password, {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
      }).valid,
    {
      message: "auth.password.weak",
      path: ["password"],
    }
  );

export const passwordResetRequestSchema = z.object({
  email: z.string().email("auth.email.invalid"),
});

export const passwordResetSubmitSchema = z.object({
  token: z.string().min(1, "auth.token.required"),
  newPassword: passwordPolicy,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "auth.password.required"),
  newPassword: passwordPolicy,
});
