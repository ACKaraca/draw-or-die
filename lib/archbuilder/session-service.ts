import { Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  type ArchBuilderExportRow,
  type ArchBuilderProjectRow,
  type ArchBuilderSessionRow,
  type ArchBuilderStepOutputRow,
  getAdminTables,
} from '@/lib/appwrite/server';

export async function getArchBuilderSessionForUser(params: {
  sessionId: string;
  userId: string;
}): Promise<{
  project: ArchBuilderProjectRow;
  session: ArchBuilderSessionRow;
} | null> {
  const tables = getAdminTables();

  let session: ArchBuilderSessionRow;
  try {
    session = await tables.getRow<ArchBuilderSessionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
      rowId: params.sessionId,
    });
  } catch {
    return null;
  }

  if (session.user_id !== params.userId) {
    return null;
  }

  let project: ArchBuilderProjectRow;
  try {
    project = await tables.getRow<ArchBuilderProjectRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
      rowId: session.project_id,
    });
  } catch {
    return null;
  }

  if (project.user_id !== params.userId) {
    return null;
  }

  return { project, session };
}

export async function listArchBuilderStepOutputs(sessionId: string): Promise<ArchBuilderStepOutputRow[]> {
  const tables = getAdminTables();
  const response = await tables.listRows<ArchBuilderStepOutputRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
    queries: [
      Query.equal('session_id', sessionId),
      Query.orderAsc('$createdAt'),
      Query.limit(200),
    ],
  });

  return response.rows;
}

export async function getArchBuilderStepOutput(params: {
  sessionId: string;
  stepKey: string;
}): Promise<ArchBuilderStepOutputRow | null> {
  const tables = getAdminTables();
  const response = await tables.listRows<ArchBuilderStepOutputRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
    queries: [
      Query.equal('session_id', params.sessionId),
      Query.equal('step_key', params.stepKey),
      Query.limit(1),
    ],
  });

  return response.rows[0] ?? null;
}

export async function listArchBuilderExports(sessionId: string): Promise<ArchBuilderExportRow[]> {
  const tables = getAdminTables();
  const response = await tables.listRows<ArchBuilderExportRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
    queries: [
      Query.equal('session_id', sessionId),
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ],
  });

  return response.rows;
}
