import { NextRequest, NextResponse } from 'next/server';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';

export async function GET(request: NextRequest) {
  const lang = getRequestLanguage(request);

  let coreCompatible = false;
  let frontCompatible = false;
  let coreError = '';
  let frontError = '';

  try {
    await import('@thatopen/components');
    coreCompatible = true;
  } catch (error) {
    coreError = error instanceof Error ? error.message : String(error);
  }

  try {
    await import('@thatopen/components-front');
    frontCompatible = true;
  } catch (error) {
    frontError = error instanceof Error ? error.message : String(error);
  }

  const ifcEnabled = process.env.FEATURE_ARCHBUILDER_IFC_EXPORT === 'true';

  return NextResponse.json({
    status: coreCompatible ? 'ok' : 'degraded',
    message: pickLocalized(
      lang,
      'ThatOpen uyumluluk kontrolü tamamlandı.',
      'ThatOpen compatibility check completed.',
    ),
    compatibility: {
      coreCompatible,
      frontCompatible,
      ifcEnabled,
    },
    notes: {
      coreError,
      frontError,
      exportStrategy: 'DXF-first with IFC feature-gated.',
    },
    budget: {
      planningStepP95Ms: 450,
      drawingGenerationP95Ms: 700,
      furniturePlacementP95Ms: 500,
      exportBuildP95Ms: 900,
    },
  });
}
