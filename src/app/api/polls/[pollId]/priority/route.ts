import { NextRequest, NextResponse } from 'next/server';
import { getPollWithOptions, listPolls, setPollAutoOpenPriority } from '../../../../../services/supabasePollsService';
import { PollPriorityPayloadSchema } from '../../../../../models/pollsSchemas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    assertAdmin(request);

    const { pollId } = await context.params;
    const body = await request.json();
    const parsed = PollPriorityPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    await getPollWithOptions(pollId);
    await setPollAutoOpenPriority(pollId, parsed.data.auto_open_priority);
    const polls = await listPolls();
    return NextResponse.json({ success: true, polls });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message, code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (message === 'poll_not_found') {
      return NextResponse.json({ error: 'Enquete não encontrada', code: 'POLL_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
