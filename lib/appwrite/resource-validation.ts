import { TablesDB } from 'node-appwrite';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  APPWRITE_TABLE_BILLING_EVENTS_ID,
  APPWRITE_TABLE_GALLERY_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  APPWRITE_TABLE_PROFILES_ID,
  createAdminClient,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';

type ValidationIssue = {
  resource: string;
  detail: string;
};

async function verifyTableExists(tables: TablesDB, tableId: string): Promise<ValidationIssue | null> {
  try {
    await tables.getTable({ databaseId: APPWRITE_DATABASE_ID, tableId });
    return null;
  } catch (error) {
    return {
      resource: tableId,
      detail: error instanceof Error ? error.message : 'Table not reachable',
    };
  }
}

async function verifyColumnExists(tables: TablesDB, tableId: string, key: string): Promise<ValidationIssue | null> {
  try {
    await tables.getColumn({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
    return null;
  } catch (error) {
    return {
      resource: `${tableId}.${key}`,
      detail: error instanceof Error ? error.message : 'Column not reachable',
    };
  }
}

async function verifyIndexExists(tables: TablesDB, tableId: string, key: string): Promise<ValidationIssue | null> {
  try {
    await tables.getIndex({ databaseId: APPWRITE_DATABASE_ID, tableId, key });
    return null;
  } catch (error) {
    return {
      resource: `${tableId}.${key}`,
      detail: error instanceof Error ? error.message : 'Index not reachable',
    };
  }
}

export async function validateCoreAppwriteResources(): Promise<ValidationIssue[]> {
  const tables = new TablesDB(createAdminClient());
  const issues: ValidationIssue[] = [];

  try {
    await tables.get({ databaseId: APPWRITE_DATABASE_ID });
  } catch (error) {
    issues.push({
      resource: APPWRITE_DATABASE_ID,
      detail: error instanceof Error ? error.message : 'Database not reachable',
    });
    logServerError('appwrite.resource-validation.database', error, { databaseId: APPWRITE_DATABASE_ID });
    return issues;
  }

  const checks = await Promise.all([
    verifyTableExists(tables, APPWRITE_TABLE_PROFILES_ID),
    verifyTableExists(tables, APPWRITE_TABLE_GALLERY_ID),
    verifyTableExists(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID),
    verifyTableExists(tables, APPWRITE_TABLE_BILLING_EVENTS_ID),
    verifyTableExists(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID),
    verifyColumnExists(tables, APPWRITE_TABLE_PROFILES_ID, 'user_id'),
    verifyColumnExists(tables, APPWRITE_TABLE_GALLERY_ID, 'user_id'),
    verifyColumnExists(tables, APPWRITE_TABLE_GALLERY_ID, 'status'),
    verifyColumnExists(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'user_id'),
    verifyColumnExists(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'user_id'),
    verifyColumnExists(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'user_id'),
    verifyIndexExists(tables, APPWRITE_TABLE_PROFILES_ID, 'profiles_user_id_idx'),
    verifyIndexExists(tables, APPWRITE_TABLE_GALLERY_ID, 'gallery_user_status_idx'),
    verifyIndexExists(tables, APPWRITE_TABLE_ANALYSIS_HISTORY_ID, 'analysis_user_deleted_idx'),
    verifyIndexExists(tables, APPWRITE_TABLE_BILLING_EVENTS_ID, 'billing_events_user_idx'),
    verifyIndexExists(tables, APPWRITE_TABLE_MEMORY_SNIPPETS_ID, 'memory_snippets_user_idx'),
  ]);

  for (const issue of checks) {
    if (issue) {
      issues.push(issue);
    }
  }

  if (issues.length > 0) {
    logServerError('appwrite.resource-validation.core', new Error('Appwrite resource validation failed'), {
      issues,
    });
  }

  return issues;
}
