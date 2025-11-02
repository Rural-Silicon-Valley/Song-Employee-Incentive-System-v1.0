import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  signature: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const requestOtpSchema = z.object({
  email: z.string().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const issueTokenSchema = z.object({
  email: z.string().email(),
});

export const registerWithTokenSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  token: z.string().min(6),
  name: z.string().min(1),
  password: z.string().min(6),
});

export const loginWithTokenSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  token: z.string().min(6),
});
