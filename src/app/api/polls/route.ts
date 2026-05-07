import { NextRequest, NextResponse } from 'next/server';
import { listPolls, upsertOptions, upsertPoll } from '../../../services/supabasePollsService';
import { PollCreatePayloadSchema } from '../../../models/pollsSchemas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function assertAdmin(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedApiKey = process.env.ADMIN_API_KEY || 'admin-bbb26-dev-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    throw new Error('Acesso negado');
  }
}

export async function GET(request: NextRequest) {
  try {
    assertAdmin(request);
    const polls = await listPolls();
    return NextResponse.json(polls);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertAdmin(request);

    const body = await request.json();
    const parsed = PollCreatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { poll, options } = parsed.data;

    const pollRows = await upsertPoll(poll);
    const savedPoll = pollRows[0];

    await upsertOptions(savedPoll.id, options);

    return NextResponse.json({ poll: savedPoll }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const status = message === 'Acesso negado' ? 401 : 500;
    return NextResponse.json({ error: 'Erro ao criar enquete', message }, { status });
  }
}

