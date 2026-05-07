import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type WeekDay = {
  date: string;
  dayLabel: string;
  isCompleted: boolean;
  isToday: boolean;
};

export type HabitSummary = {
  id: number;
  title: string;
  category: string;
  color: string;
  createdAt: string;
  isTodayCompleted: boolean;
  streak: number;
  totalCompleted: number;
  week: WeekDay[];
};

export type GrassDay = {
  date: string;
  dayLabel: string;
  count: number;
  level: number;
  isToday: boolean;
};

export type HabitDashboard = {
  habits: HabitSummary[];
  todayDate: string;
  selectedHabitId: number | "all";
  todayCompletedCount: number;
  totalHabitCount: number;
  monthGrass: GrassDay[];
  yearGrass: GrassDay[];
  pointMission: {
    title: string;
    description: string;
    progress: number;
    target: number;
    status: "concept";
  };
};

type HabitRow = {
  id: number;
  title: string;
  category: string | null;
  color: string | null;
  created_at: string;
  sort_order: number | null;
};

type CheckRow = {
  check_date: string;
};

type CountRow = {
  check_date: string;
  count: number;
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
    category TEXT NOT NULL DEFAULT '생활',
    color TEXT NOT NULL DEFAULT '#3182f6',
    sort_order INTEGER NOT NULL DEFAULT 0,
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

migrateColumn("habits", "category", "TEXT NOT NULL DEFAULT '생활'");
migrateColumn("habits", "color", "TEXT NOT NULL DEFAULT '#3182f6'");
migrateColumn("habits", "sort_order", "INTEGER NOT NULL DEFAULT 0");

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const defaultColors = ["#3182f6", "#00c471", "#ff8a00", "#8b5cf6", "#f04452"];

function migrateColumn(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];

  if (!columns.some((item) => item.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

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

function getActiveHabits() {
  return db
    .prepare(
      `SELECT id, title, category, color, created_at, sort_order
       FROM habits
       WHERE archived_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as HabitRow[];
}

function getHabitById(id: number) {
  return db
    .prepare("SELECT id, title, category, color, created_at, sort_order FROM habits WHERE id = ? AND archived_at IS NULL")
    .get(id) as HabitRow | undefined;
}

export function createHabit(title: string) {
  const normalized = normalizeTitle(title);
  const row = db.prepare("SELECT COUNT(*) AS count FROM habits WHERE archived_at IS NULL").get() as { count: number };
  const color = defaultColors[row.count % defaultColors.length];

  db.prepare("INSERT INTO habits (title, category, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)").run(
    normalized,
    inferCategory(normalized),
    color,
    row.count,
    new Date().toISOString(),
  );
}

export function updateHabit(id: number, title: string) {
  const normalized = normalizeTitle(title);
  const habit = getHabitById(id);

  if (!habit) {
    throw new Error("수정할 습관이 없어요.");
  }

  db.prepare("UPDATE habits SET title = ?, category = ? WHERE id = ?").run(normalized, inferCategory(normalized), id);
}

export function archiveHabit(id: number) {
  const habit = getHabitById(id);

  if (!habit) {
    return;
  }

  db.prepare("UPDATE habits SET archived_at = ? WHERE id = ?").run(new Date().toISOString(), id);
}

export function setTodayCheck(habitId: number, isCompleted: boolean) {
  const habit = getHabitById(habitId);

  if (!habit) {
    throw new Error("먼저 습관을 만들어주세요.");
  }

  const today = getKstDateString();
  db.prepare(
    `INSERT INTO habit_checks (habit_id, check_date, is_completed, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(habit_id, check_date)
     DO UPDATE SET is_completed = excluded.is_completed, updated_at = CURRENT_TIMESTAMP`,
  ).run(habitId, today, isCompleted ? 1 : 0);
}

export function getHabitDashboard(selectedHabitId: number | "all" = "all"): HabitDashboard {
  const today = getKstDateString();
  const habits = getActiveHabits();
  const summaries = habits.map((habit) => toHabitSummary(habit, today));
  const selectedId = selectedHabitId !== "all" && habits.some((habit) => habit.id === selectedHabitId) ? selectedHabitId : "all";
  const todayCompletedCount = summaries.filter((habit) => habit.isTodayCompleted).length;

  return {
    habits: summaries,
    todayDate: today,
    selectedHabitId: selectedId,
    todayCompletedCount,
    totalHabitCount: summaries.length,
    monthGrass: getGrass(today, "month", selectedId),
    yearGrass: getGrass(today, "year", selectedId),
    pointMission: {
      title: "주간 루틴 보너스",
      description: "이번 주 5일 이상 체크하면 토스 포인트 미션 후보가 돼요. 실제 지급은 앱인토스 프로모션 정책 확인 후 연결합니다.",
      progress: countCompletedDays(addDays(today, -6), today, selectedId),
      target: 5,
      status: "concept",
    },
  };
}

function toHabitSummary(habit: HabitRow, today: string): HabitSummary {
  const completedRows = db
    .prepare("SELECT check_date FROM habit_checks WHERE habit_id = ? AND is_completed = 1 ORDER BY check_date DESC")
    .all(habit.id) as CheckRow[];

  const completedDates = new Set(completedRows.map((row) => row.check_date));

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category ?? "생활",
    color: habit.color ?? "#3182f6",
    createdAt: habit.created_at,
    isTodayCompleted: completedDates.has(today),
    streak: calculateStreak(today, completedDates),
    totalCompleted: completedDates.size,
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

function getGrass(today: string, range: "month" | "year", selectedHabitId: number | "all") {
  const start = range === "month" ? `${today.slice(0, 7)}-01` : `${today.slice(0, 4)}-01-01`;
  const end = range === "month" ? getMonthEnd(today) : `${today.slice(0, 4)}-12-31`;
  const counts = getCounts(start, end, selectedHabitId);
  const days: GrassDay[] = [];
  let cursor = start;

  while (cursor <= end) {
    const count = counts.get(cursor) ?? 0;
    days.push({
      date: cursor,
      dayLabel: getDayLabel(cursor),
      count,
      level: getLevel(count),
      isToday: cursor === today,
    });
    cursor = addDays(cursor, 1);
  }

  return days;
}

function getCounts(start: string, end: string, selectedHabitId: number | "all") {
  const query =
    selectedHabitId === "all"
      ? `SELECT check_date, COUNT(*) AS count
         FROM habit_checks hc
         JOIN habits h ON h.id = hc.habit_id
         WHERE hc.is_completed = 1 AND h.archived_at IS NULL AND check_date BETWEEN ? AND ?
         GROUP BY check_date`
      : `SELECT check_date, COUNT(*) AS count
         FROM habit_checks
         WHERE habit_id = ? AND is_completed = 1 AND check_date BETWEEN ? AND ?
         GROUP BY check_date`;

  const rows = (selectedHabitId === "all"
    ? db.prepare(query).all(start, end)
    : db.prepare(query).all(selectedHabitId, start, end)) as CountRow[];

  return new Map(rows.map((row) => [row.check_date, row.count]));
}

function countCompletedDays(start: string, end: string, selectedHabitId: number | "all") {
  return Array.from(getCounts(start, end, selectedHabitId).values()).filter((count) => count > 0).length;
}

function getMonthEnd(today: string) {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function getLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function inferCategory(title: string) {
  if (/소비|저축|돈|가계|카드|투자|지출/.test(title)) return "금융";
  if (/걷|운동|물|수면|건강|러닝/.test(title)) return "건강";
  if (/책|공부|영어|독서|학습/.test(title)) return "학습";
  return "생활";
}
