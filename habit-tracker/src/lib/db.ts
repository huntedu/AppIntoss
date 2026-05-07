import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type WeekDay = {
  date: string;
  dayLabel: string;
  isCompleted: boolean;
  isToday: boolean;
};

export type HabitSnapshot = {
  habit: {
    id: number;
    title: string;
    createdAt: string;
  } | null;
  todayDate: string;
  isTodayCompleted: boolean;
  streak: number;
  totalCompleted: number;
  week: WeekDay[];
};

type HabitRow = {
  id: number;
  title: string;
  created_at: string;
};

type CheckRow = {
  check_date: string;
};

const dataDir = path.join(process.cwd(), ".data");
const dbPath = path.join(dataDir, "habit-tracker.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath, { timeout: 5000 });
db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TEXT
  );

  CREATE TABLE IF NOT EXISTS habit_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    check_date TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, check_date),
    FOREIGN KEY(habit_id) REFERENCES habits(id)
  );
`);

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function getKstDateString(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getDayLabel(dateString: string) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  return dayLabels[date.getUTCDay()];
}

function normalizeTitle(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("습관 이름을 입력해주세요.");
  }

  if (normalized.length > 20) {
    throw new Error("습관 이름은 20자 이내로 적어주세요.");
  }

  return normalized;
}

function getActiveHabit() {
  return db
    .prepare("SELECT id, title, created_at FROM habits WHERE archived_at IS NULL ORDER BY id DESC LIMIT 1")
    .get() as HabitRow | undefined;
}

export function createHabit(title: string) {
  const normalized = normalizeTitle(title);
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    db.prepare("UPDATE habits SET archived_at = ? WHERE archived_at IS NULL").run(now);
    db.prepare("INSERT INTO habits (title, created_at) VALUES (?, ?)").run(normalized, now);
  });

  transaction();
}

export function updateHabit(title: string) {
  const normalized = normalizeTitle(title);
  const habit = getActiveHabit();

  if (!habit) {
    throw new Error("수정할 습관이 없어요.");
  }

  db.prepare("UPDATE habits SET title = ? WHERE id = ?").run(normalized, habit.id);
}

export function archiveHabit() {
  const habit = getActiveHabit();

  if (!habit) {
    return;
  }

  db.prepare("UPDATE habits SET archived_at = ? WHERE id = ?").run(new Date().toISOString(), habit.id);
}

export function setTodayCheck(isCompleted: boolean) {
  const habit = getActiveHabit();

  if (!habit) {
    throw new Error("먼저 습관을 만들어주세요.");
  }

  const today = getKstDateString();

  if (isCompleted) {
    db.prepare(
      `INSERT INTO habit_checks (habit_id, check_date, is_completed, updated_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(habit_id, check_date)
       DO UPDATE SET is_completed = 1, updated_at = CURRENT_TIMESTAMP`,
    ).run(habit.id, today);
    return;
  }

  db.prepare(
    `INSERT INTO habit_checks (habit_id, check_date, is_completed, updated_at)
     VALUES (?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(habit_id, check_date)
     DO UPDATE SET is_completed = 0, updated_at = CURRENT_TIMESTAMP`,
  ).run(habit.id, today);
}

export function getHabitSnapshot(): HabitSnapshot {
  const today = getKstDateString();
  const habit = getActiveHabit();

  if (!habit) {
    return {
      habit: null,
      todayDate: today,
      isTodayCompleted: false,
      streak: 0,
      totalCompleted: 0,
      week: getWeek(today, new Set()),
    };
  }

  const completedRows = db
    .prepare("SELECT check_date FROM habit_checks WHERE habit_id = ? AND is_completed = 1 ORDER BY check_date DESC")
    .all(habit.id) as CheckRow[];

  const completedDates = new Set(completedRows.map((row) => row.check_date));
  const totalCompleted = completedDates.size;
  const isTodayCompleted = completedDates.has(today);
  const streak = calculateStreak(today, completedDates);

  return {
    habit: {
      id: habit.id,
      title: habit.title,
      createdAt: habit.created_at,
    },
    todayDate: today,
    isTodayCompleted,
    streak,
    totalCompleted,
    week: getWeek(today, completedDates),
  };
}

function calculateStreak(today: string, completedDates: Set<string>) {
  let streak = 0;
  let cursor = today;

  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getWeek(today: string, completedDates: Set<string>) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);

    return {
      date,
      dayLabel: getDayLabel(date),
      isCompleted: completedDates.has(date),
      isToday: date === today,
    };
  });
}
