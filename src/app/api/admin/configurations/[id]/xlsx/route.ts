import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { buildBOMRowsExtended, generateXLSXBytes } from '@/features/bom/exportXLS';
import type { ConfigState, BOMResult } from '@/core/types';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const { id } = await params;
  const code = parseInt(id, 10);
  if (isNaN(code)) return NextResponse.json({ error: 'Ungueltiger Code' }, { status: 400 });

  const sb = createServiceSupabaseClient();
  const { data, error } = await sb
    .from('saved_configs')
    .select('config_json, bom_json')
    .eq('config_code', code)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  const config = data.config_json as ConfigState;
  const bom: BOMResult | null = (data.bom_json as BOMResult) ?? computeBOM(config);

  if (!bom) return NextResponse.json({ error: 'BOM-Berechnung fehlgeschlagen' }, { status: 500 });

  const { rows, overrideRows } = buildBOMRowsExtended(bom, null, String(code));

  const xlsxBytes = generateXLSXBytes(rows, overrideRows);

  return new NextResponse(xlsxBytes.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Lightmodul_Export.xlsx"',
    },
  });
}
