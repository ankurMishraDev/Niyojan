import * as SQLite from 'expo-sqlite';

// Open or create the database
export const db = SQLite.openDatabaseSync('niyojan.db');

export const initDb = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      fields TEXT, -- JSON string
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      formId TEXT,
      volunteerId TEXT,
      data TEXT, -- JSON string
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 0
    );

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
};
