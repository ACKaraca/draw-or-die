import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_MENTOR_CHATS_ID,
  APPWRITE_TABLE_MENTOR_MESSAGES_ID,
  MentorChatRow,
  MentorMessageRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { isAppwriteColumnNotAvailable } from '@/lib/appwrite/error-utils';
import { logServerError } from '@/lib/logger';
import { pickLocalized, resolveLanguageFromAcceptLanguage } from '@/lib/i18n';

const MAX_PAGE_SIZE = 200;

async function runWithResourceRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isAppwriteColumnNotAvailable(error)) {
      throw error;
    }

    await ensureCoreAppwriteResources();
    return operation();
  }
}

function toMessageDto(row: MentorMessageRow) {
  return {
    id: row.$id,
    role: row.role,
    text: row.content,
    tokens: row.tokens,
    createdAt: row.$createdAt,
    attachmentName: row.attachment_name || null,
    attachmentUrl: row.attachment_url || null,
    attachmentMime: row.attachment_mime || null,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chatId: string }> },
) {
  const { chatId } = await context.params;
  const headerLang = resolveLanguageFromAcceptLanguage(request.headers.get('accept-language'), 'tr');

  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(headerLang, 'Giriş yapmanız gerekiyor.', 'You must sign in.') },
        { status: 401 },
      );
    }

    if (!chatId) {
      return NextResponse.json(
        { error: pickLocalized(headerLang, 'Sohbet kimliği gerekli.', 'Chat ID is required.') },
        { status: 400 },
      );
    }

    await ensureCoreAppwriteResources();
    const tables = getAdminTables();
    const chat = await runWithResourceRetry(() => tables.getRow<MentorChatRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MENTOR_CHATS_ID,
      rowId: chatId,
    }));

    if (chat.user_id !== user.id) {
      return NextResponse.json(
        {
          error: pickLocalized(headerLang, 'Bu sohbete erişim yetkiniz yok.', 'You do not have access to this chat.'),
        },
        { status: 403 },
      );
    }

    const params = request.nextUrl.searchParams;
    const limitRaw = Number(params.get('limit') ?? '120');
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(MAX_PAGE_SIZE, limitRaw)) : 120;

    const result = await runWithResourceRetry(() => tables.listRows<MentorMessageRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID,
      queries: [
        Query.equal('chat_id', chatId),
        Query.orderAsc('$createdAt'),
        Query.limit(limit),
      ],
      total: true,
    }));

    return NextResponse.json({
      chat: {
        id: chat.$id,
        title: chat.title,
        tokensUsed: chat.tokens_used,
        tokenLimit: chat.token_limit,
        status: chat.status,
        monthKey: chat.month_key,
      },
      items: result.rows.map(toMessageDto),
      total: result.total,
    });
  } catch (error: unknown) {
    const typed = error as { code?: number };
    if (typed?.code === 404) {
      return NextResponse.json(
        { error: pickLocalized(headerLang, 'Sohbet bulunamadı.', 'Chat not found.') },
        { status: 404 },
      );
    }

    logServerError('api.mentor.chats.messages.GET', error, { chatId });
    return NextResponse.json(
      { error: pickLocalized(headerLang, 'Sohbet mesajları alınamadı.', 'Could not load chat messages.') },
      { status: 500 },
    );
  }
}
