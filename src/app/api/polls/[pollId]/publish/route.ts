import { NextRequest, NextResponse } from 'next/server';
import { getPollWithOptions, listPolls, publishPoll } from '../../../../../services/supabasePollsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    assertAdmin(request);

    const { pollId } = await context.params;
    const { poll } = await getPollWithOptions(pollId);

    if (poll.status === 'closed') {
      return NextResponse.json(
        { error: 'Enquete encerrada não pode ser ativada.', code: 'POLL_CLOSED' },
        { status: 409 }
      );
    }

    if (poll.status === 'active') {
      return NextResponse.json(
        { error: 'Esta enquete já está ativa.', code: 'ALREADY_ACTIVE' },
        { status: 409 }
      );
    }

    await publishPoll(pollId);
    const polls = await listPolls();
    return NextResponse.json({ success: true, polls });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'Acesso negado') {
      return NextResponse.json({ error: message, code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const lower = message.toLowerCase();
    if (
      lower.includes('polls_one_live') ||
      lower.includes('uniq_active_poll') ||
      lower.includes('duplicate key') ||
      lower.includes('unique constraint') ||
      lower.includes('23505')
    ) {
      return NextResponse.json(
        {
          error: 'Conflito ao ativar (outra enquete ativa no mesmo destino). Atualize a lista e tente de novo.',
          code: 'MULTIPLE_ACTIVE_POLLS',
        },
        { status: 409 }
      );
    }
    if (message === 'poll_not_found') {
      return NextResponse.json({ error: 'Enquete não encontrada', code: 'POLL_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
