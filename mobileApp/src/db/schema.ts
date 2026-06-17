import * as SQLite from 'expo-sqlite';

// Open or create the database
export const db = SQLite.openDatabaseSync('niyojan.db');

export const initDb = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      templateVersionId TEXT,
      title TEXT,
      description TEXT,
      fields TEXT,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      remoteId TEXT,
      templateVersionId TEXT,
      formId TEXT,
      volunteerId TEXT,
      respondentName TEXT,
      locationText TEXT,
      latitude REAL,
      longitude REAL,
      data TEXT,
      submittedLanguage TEXT DEFAULT 'en',
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      localId TEXT NOT NULL,
      remoteId TEXT,
      op TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      nextAttemptAt TEXT,
      idempotencyKey TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, nextAttemptAt);

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      ngoId TEXT,
      volunteerId TEXT,
      status TEXT,
      dueDate TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      assignmentId TEXT,
      ngoId TEXT,
      volunteerId TEXT,
      content TEXT,
      rating INTEGER,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 0
    );
  `);

  // ── Migration: add synced column to surveys if it doesn't exist yet.
  // ALTER TABLE IF COLUMN EXISTS is not supported in SQLite — use try/catch.
  try {
    db.execSync('ALTER TABLE surveys ADD COLUMN synced INTEGER DEFAULT 0');
  } catch {
    // Column already exists — safe to ignore
  }
};
