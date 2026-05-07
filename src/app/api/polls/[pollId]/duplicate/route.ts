import { NextRequest, NextResponse } from 'next/server';
import { duplicatePoll, listPolls } from '../../../../../services/supabasePollsService';

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
    const poll = await duplicatePoll(pollId);
    const polls = await listPolls();
    return NextResponse.json({ success: true, poll, polls });
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
