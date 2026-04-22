import { z } from 'zod';
import { MAX_COLS, MAX_ROWS, MAX_DEPTH, ELEMENT_SIZE_MM } from '@/core/constants';

// ─── Cell & Grid Schemas ─────────────────────────────────────────────────────

export const CellTypeSchema = z.enum(['', 'O', 'RF', 'RL', 'BT']);

export const CellSchema = z.object({
  type:    CellTypeSchema,
  shelves: z.number().int().min(0).max(2).optional().default(0),
});

// ─── ConfigState Schema ──────────────────────────────────────────────────────

export const ConfigStateSchema = z.object({
  cols:         z.array(z.literal(ELEMENT_SIZE_MM)).min(1).max(MAX_COLS),
  rows:         z.array(z.literal(ELEMENT_SIZE_MM)).min(1).max(MAX_ROWS),
  depthLayers:  z.number().int().min(1).max(MAX_DEPTH),
  grid:         z.array(z.array(z.array(CellSchema))),
  profileColor: z.string(),
  footer:       z.string(),
  opts: z.object({
    footer:  z.boolean().optional().default(true),
    shelves: z.boolean().optional().default(false),
  }),
  /** Produktrahmen-Zuordnung: faceId → true */
  frames: z.record(z.string(), z.boolean()).optional().default({}),
});

// ─── Request Schemas ─────────────────────────────────────────────────────────

export const BomRequestSchema = z.object({
  config:   ConfigStateSchema,
  currency: z.enum(['EUR', 'CHF']).optional(),
});

export const ConfigSaveSchema = z.object({
  config:     ConfigStateSchema,
  screenshot: z.string().max(5_000_000).nullable().optional(),
  bom:        z.unknown().nullable().optional(),
});

export const DatasheetRequestSchema = z.object({
  config:       ConfigStateSchema,
  includePrice: z.boolean().optional(),
  screenshot3d: z.string().max(5_000_000).nullable().optional(),
  currency:     z.enum(['EUR', 'CHF']).optional(),
  moebelId:     z.string().max(20).optional(),
});

export const OrderRequestSchema = z.object({
  configCodes:     z.array(z.number().int().positive()).min(1).max(50),
  customerName:    z.string().min(1, 'Name ist erforderlich').max(200),
  customerEmail:   z.string().email('Ungueltige E-Mail-Adresse').max(200),
  customerPhone:   z.string().max(50).optional(),
  customerCompany: z.string().max(200).optional(),
  customerStreet:  z.string().max(200).optional(),
  customerZip:     z.string().max(20).optional(),
  customerCity:    z.string().max(100).optional(),
  note:            z.string().max(2000).optional(),
  currency:        z.enum(['EUR', 'CHF']).optional(),
  gdprConsent:     z.literal(true, {
    error: () => ({ message: 'Datenschutz-Einwilligung erforderlich' }),
  }),
  configSummary: z.string().max(500).optional(),
});

export const MultiOfferRequestSchema = z.object({
  configCodes: z.array(z.number().int().positive()).min(1).max(50),
  currency:    z.enum(['EUR', 'CHF']).optional(),
  quantities:  z.record(z.string(), z.number().int().positive()).optional(),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
}
