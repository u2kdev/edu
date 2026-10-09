import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("auth.email.invalid"),
  password: z.string().min(6, "auth.password.min_6"),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z
  .object({
    email: z.string().email("auth.email.invalid"),
    password: z.string().min(10, "auth.password.min_10").max(128, "auth.password.max_128"),
    fullName: z.string().min(2, "auth.fullName.min_2").max(100, "auth.fullName.max_100"),
    phone: z.string().optional(),
    inviteCode: z.string().min(3),
    locale: z.enum(["ru", "uz"]).optional(),
    lang: z.enum(["ru", "uz"]).optional(),
  })
  .refine(
    (data) => data.password.toLowerCase() !== data.email.toLowerCase(),
    {
      message: "Пароль не должен совпадать с email",
      path: ["password"],
    }
  );

export const passwordResetRequestSchema = z.object({
  email: z.string().email("auth.email.invalid"),
});

const passwordPolicy = z
  .string()
  .min(8, "auth.password.min_8")
  .max(50, "auth.password.max_50");

export const passwordResetSubmitSchema = z.object({
  token: z.string().min(1, "auth.token.required"),
  newPassword: passwordPolicy,
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "auth.password.required"),
  newPassword: passwordPolicy,
});
