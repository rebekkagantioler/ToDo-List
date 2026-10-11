import Database from 'better-sqlite3';

export const db = new Database(process.env.DATABASE_PATH || 'planraum.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT DEFAULT '', semester TEXT NOT NULL, ects REAL NOT NULL DEFAULT 5, hours_per_ects REAL NOT NULL DEFAULT 25, color TEXT NOT NULL DEFAULT '#3b82f6', description TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', area TEXT NOT NULL CHECK(area IN ('Universität','Privat')), type TEXT NOT NULL, course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL, deadline TEXT, estimate_minutes INTEGER NOT NULL DEFAULT 60, priority TEXT NOT NULL DEFAULT 'Mittel', status TEXT NOT NULL DEFAULT 'Offen', tracking INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT);
CREATE TABLE IF NOT EXISTS work_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Selbstlernen', note TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS planned_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE, course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL, title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Arbeit');
CREATE TABLE IF NOT EXISTS recurring_events (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE, title TEXT NOT NULL, weekday INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT, auto_track INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

export function allData() {
  return {
    courses: db.prepare('SELECT * FROM courses ORDER BY name').all(),
    tasks: db.prepare(`SELECT tasks.*, courses.name AS course_name, courses.code AS course_code, courses.color AS course_color FROM tasks LEFT JOIN courses ON courses.id = tasks.course_id ORDER BY CASE status WHEN 'Offen' THEN 0 WHEN 'In Bearbeitung' THEN 1 ELSE 2 END, deadline IS NULL, deadline`).all(),
    sessions: db.prepare('SELECT * FROM work_sessions ORDER BY started_at DESC').all(),
    blocks: db.prepare(`SELECT planned_blocks.*, tasks.title AS task_title, courses.name AS course_name, courses.color AS course_color FROM planned_blocks LEFT JOIN tasks ON tasks.id = planned_blocks.task_id LEFT JOIN courses ON courses.id = planned_blocks.course_id ORDER BY starts_at`).all(),
    recurring: db.prepare('SELECT * FROM recurring_events').all(),
    settings: db.prepare('SELECT * FROM settings').all()
  };
}
