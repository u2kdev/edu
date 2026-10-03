import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  email: z.string().email("Неверный формат email"),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(50),
  fullName: z.string().min(2, "Введите полное имя").max(100),
  inviteCode: z.string().optional(),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Неверный формат email"),
});

export const passwordResetSubmitSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  newPassword: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
});
