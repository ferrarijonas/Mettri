import { z } from 'zod';

export const CanonicalPhoneSchema = z.object({
  raw: z.string().min(1),
  digits: z.string().optional(),
  e164: z.string().optional(),
  label: z.string().optional(),
});

export type CanonicalPhone = z.infer<typeof CanonicalPhoneSchema>;

export const CanonicalSourceSchema = z.object({
  filename: z.string().min(1),
  importedAtIso: z.string().datetime(),
  profileId: z.string().optional(),
});

export type CanonicalSource = z.infer<typeof CanonicalSourceSchema>;

export const CanonicalClientSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nickname: z.string().optional(),

  phones: z.array(CanonicalPhoneSchema).default([]),
  emails: z.array(z.string().email()).default([]),

  addressFreeform: z.string().optional(),

  source: CanonicalSourceSchema,

  confidence: z.record(z.number().min(0).max(1)).default({}),

  raw: z.record(z.unknown()).optional(),
});

export type CanonicalClient = z.infer<typeof CanonicalClientSchema>;
