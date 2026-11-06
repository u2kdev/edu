import { z } from "zod";

export const registerPushTokenSchema = z.object({
  pushToken: z.string().min(5, "pushToken is required"),
  platform: z.enum(["ios", "android", "web"]),
  deviceInfo: z.string().optional(),
});

export const unregisterPushTokenSchema = z.object({
  pushToken: z.string().min(5, "pushToken is required"),
});
