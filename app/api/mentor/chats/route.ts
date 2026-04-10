import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_TABLE_MENTOR_CHATS_ID,
  APPWRITE_TABLE_MENTOR_MESSAGES_ID,
  MentorChatRow,
  MentorMessageRow,
  getAdminStorage,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { isAppwriteColumnNotAvailable } from '@/lib/appwrite/error-utils';
import { logServerError } from '@/lib/logger';
import {
  MENTOR_TOKEN_LIMITS,
  estimateTokenCount,
  getCurrentMonthKey,
} from '@/lib/mentor-limits';

const MAX_PAGE_SIZE = 30;
const MAX_DELETE_PAGE_SIZE = 100;

async function runInParallelBatches<T>(
  items: T[],
  batchSize: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.allSettled(batch.map((item) => worker(item)));
  }
}

function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/\/files\/([^/]+)\//i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function toChatDto(row: MentorChatRow) {
  return {
    id: row.$id,
    title: row.title,
    monthKey: row.month_key,
    tokenLimit: row.token_limit,
    tokensUsed: row.tokens_used,
    isPremiumChat: Boolean(row.is_premium_chat),
    status: row.status,
    lastMessageAt: row.last_message_at ?? null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

function getDefaultWelcomeText(): string {
  return 'Merhaba, ben AI mentorun. Hedefini yaz; konsept, pafta dili, savunma stratejisi ve iyilestirme adimlarini birlikte netlestirelim.';
}

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

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const params = request.nextUrl.searchParams;
    const limitRaw = Number(params.get('limit') ?? '20');
    const offsetRaw = Number(params.get('offset') ?? '0');

    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(MAX_PAGE_SIZE, limitRaw)) : 20;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const tables = getAdminTables();
    const result = await runWithResourceRetry(() => tables.listRows<MentorChatRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MENTOR_CHATS_ID,
      queries: [
        Query.equal('user_id', user.id),
        Query.orderDesc('$updatedAt'),
        Query.limit(limit),
        Query.offset(offset),
      ],
      total: true,
    }));

    return NextResponse.json({
      items: result.rows.map(toChatDto),
      total: result.total,
    });
  } catch (error) {
    logServerError('api.mentor.chats.GET', error);
    return NextResponse.json({ error: 'Mentor sohbetleri yüklenemedi.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const profile = await getOrCreateProfile(user);
    const isPremium = profile.is_premium;
    const monthKey = getCurrentMonthKey();
    const tokenLimit = isPremium ? MENTOR_TOKEN_LIMITS.PREMIUM_PER_CHAT : MENTOR_TOKEN_LIMITS.FREE_PER_CHAT;

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
    };

    const title = (body.title ?? '').trim() || 'Yeni Mentorluk Sohbeti';

    const tables = getAdminTables();

    const nowIso = new Date().toISOString();
    const welcomeText = getDefaultWelcomeText();
    const welcomeTokens = estimateTokenCount(welcomeText);

    const chat = await runWithResourceRetry(() => tables.createRow<MentorChatRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MENTOR_CHATS_ID,
      rowId: ID.unique(),
      data: {
        user_id: user.id,
        title,
        month_key: monthKey,
        token_limit: tokenLimit,
        tokens_used: welcomeTokens,
        is_premium_chat: isPremium,
        status: 'active',
        last_message_at: nowIso,
      },
    }));

    await tables.createRow<MentorMessageRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID,
      rowId: ID.unique(),
      data: {
        chat_id: chat.$id,
        user_id: user.id,
        role: 'mentor',
        content: welcomeText,
        tokens: welcomeTokens,
        attachment_name: '',
        attachment_url: '',
        attachment_mime: '',
      },
    });

    return NextResponse.json({ item: toChatDto(chat) });
  } catch (error) {
    logServerError('api.mentor.chats.POST', error);
    return NextResponse.json({ error: 'Mentor sohbeti oluşturulamadı.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const body = (await request.json().catch(() => ({}))) as { chatId?: unknown };
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    if (!chatId) {
      return NextResponse.json({ error: 'chatId gerekli.' }, { status: 400 });
    }

    const tables = getAdminTables();
    let chat: MentorChatRow;

    try {
      chat = await tables.getRow<MentorChatRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_MENTOR_CHATS_ID,
        rowId: chatId,
      });
    } catch {
      return NextResponse.json({ error: 'Mentor sohbeti bulunamadı.' }, { status: 404 });
    }

    if (chat.user_id !== user.id) {
      return NextResponse.json({ error: 'Bu mentor sohbeti size ait değil.' }, { status: 403 });
    }

    const collectedMessages: MentorMessageRow[] = [];
    let offset = 0;

    while (true) {
      const page = await tables.listRows<MentorMessageRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID,
        queries: [
          Query.equal('chat_id', chatId),
          Query.orderAsc('$createdAt'),
          Query.limit(MAX_DELETE_PAGE_SIZE),
          Query.offset(offset),
        ],
      });

      if (!page.rows.length) {
        break;
      }

      collectedMessages.push(...page.rows);

      if (page.rows.length < MAX_DELETE_PAGE_SIZE) {
        break;
      }

      offset += MAX_DELETE_PAGE_SIZE;
    }

    const storage = getAdminStorage();
    const fileIds = new Set<string>();

    for (const message of collectedMessages) {
      const fileId = extractFileIdFromUrl(message.attachment_url || '');
      if (fileId) {
        fileIds.add(fileId);
      }
    }

    await runInParallelBatches(collectedMessages, 20, async (message) => {
      try {
        await tables.deleteRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_MENTOR_MESSAGES_ID,
          rowId: message.$id,
        });
      } catch {
        // ignore per-message cleanup failures; the chat row removal is the source of truth
      }
    });

    await runInParallelBatches(Array.from(fileIds), 10, async (fileId) => {
      try {
        await storage.deleteFile({
          bucketId: APPWRITE_BUCKET_GALLERY_ID,
          fileId,
        });
      } catch {
        // ignore files already removed or not owned anymore
      }
    });

    try {
      await tables.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_MENTOR_CHATS_ID,
        rowId: chat.$id,
      });
    } catch (error) {
      logServerError('api.mentor.chats.DELETE', error, { chatId });
      return NextResponse.json({ error: 'Mentor sohbeti silinemedi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError('api.mentor.chats.DELETE', error);
    return NextResponse.json({ error: 'Mentor sohbeti silinemedi.' }, { status: 500 });
  }
}
