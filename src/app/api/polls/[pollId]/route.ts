import { NextRequest, NextResponse } from 'next/server';
import {
  getPollWithOptions,
  updatePoll,
  upsertOptions,
} from '../../../../services/supabasePollsService';
import { PollUpdatePayloadSchema } from '../../../../models/pollsSchemas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    assertAdmin(request);

    const { pollId } = await context.params;
    const { poll, options } = await getPollWithOptions(pollId);
    return NextResponse.json({ poll, options });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    if (message === 'poll_not_found') {
      return NextResponse.json({ error: 'Enquete não encontrada' }, { status: 404 });
    }
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    assertAdmin(request);
    const body = await request.json();
    const parsed = PollUpdatePayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { poll, options } = parsed.data;
    const { pollId } = await context.params;

    const { poll: existingPoll } = await getPollWithOptions(pollId);

    if (existingPoll.status === 'closed') {
      return NextResponse.json(
        {
          error: 'Enquete não editável',
          message: 'Enquetes encerradas não podem ser editadas.',
        },
        { status: 409 }
      );
    }

    const isLive = existingPoll.status === 'active';
    const nextStatus = isLive ? existingPoll.status : (poll.status ?? 'draft');

    await updatePoll(pollId, {
      title: poll.title,
      subtitle: poll.subtitle ?? existingPoll.subtitle ?? null,
      description: poll.description ?? existingPoll.description ?? null,
      status: nextStatus,
      type: poll.type,
      open_at: poll.open_at ?? existingPoll.open_at ?? null,
      close_at: poll.close_at ?? existingPoll.close_at ?? null,
      auto_open_on_app_launch: poll.auto_open_on_app_launch ?? existingPoll.auto_open_on_app_launch,
      auto_open_priority: poll.auto_open_priority ?? existingPoll.auto_open_priority,
      show_in_home_hub: poll.show_in_home_hub ?? existingPoll.show_in_home_hub,
      allow_multiple_votes: poll.allow_multiple_votes ?? existingPoll.allow_multiple_votes,
    });

    await upsertOptions(pollId, options.map((o) => ({ ...o, poll_id: pollId })));

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: 'Erro ao atualizar enquete', message }, { status });
  }
}

