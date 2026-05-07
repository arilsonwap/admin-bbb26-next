import { NextRequest, NextResponse } from 'next/server';
import { closePoll, getPollWithOptions, listPolls } from '../../../../../services/supabasePollsService';

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
        { error: 'Enquete já está fechada', code: 'POLL_ALREADY_CLOSED' },
        { status: 409 }
      );
    }

    await closePoll(pollId);
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
    if (message === 'poll_close_no_rows') {
      return NextResponse.json(
        {
          error:
            'O encerramento não atualizou nenhuma linha (id inexistente ou filtro bloqueado). Verifique o id no Supabase e RLS/policies.',
          code: 'CLOSE_NO_ROWS',
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

