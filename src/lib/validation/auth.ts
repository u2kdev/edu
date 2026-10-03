import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("auth.email.invalid"),
  password: z.string().min(6, "auth.password.min_6"),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  email: z.string().email("auth.email.invalid"),
  password: z.string().min(8, "auth.password.min_8").max(50, "auth.password.max_50"),
  fullName: z.string().min(2, "auth.fullName.min_2").max(100, "auth.fullName.max_100"),
  inviteCode: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("auth.email.invalid"),
});

export const passwordResetSubmitSchema = z.object({
  token: z.string().min(1, "auth.token.required"),
  newPassword: z.string().min(8, "auth.password.min_8"),
});
