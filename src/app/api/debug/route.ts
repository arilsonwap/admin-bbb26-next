import { NextResponse } from 'next/server';
import { debugParticipantImage, normalizeName } from '../../../utils/avatarUtils';

export async function GET() {
  // Testar alguns nomes
  const testNames = [
    'Babu Santana',
    'Sol Vega',
    'Jonas Sulzbach',
    'Sarah Andrade',
    'Alberto Cowboy'
  ];

  const results = testNames.map(name => ({
    original: name,
    normalized: normalizeName(name),
    debug: debugParticipantImage(name)
  }));

  return NextResponse.json({
    testResults: results,
    availableKeys: Object.keys(require('../../../utils/avatarUtils').localImages || {})
  });
}