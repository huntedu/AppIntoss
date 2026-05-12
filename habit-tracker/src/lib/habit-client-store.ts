import { Storage } from "@apps-in-toss/web-framework";

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

type HabitRecord = {
  id: number;
  title: string;
  category: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  archivedAt?: string;
};

type HabitState = {
  version: 1;
  nextId: number;
  habits: HabitRecord[];
  checks: Record<string, Record<string, boolean>>;
};

const STORAGE_KEY = "appintoss:today-habit:v1";
const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const defaultColors = ["#3182f6", "#00c471", "#ff8a00", "#8b5cf6", "#f04452"];

export async function loadHabitDashboard(selectedHabitId: number | "all" = "all") {
  const state = await readState();
  return toDashboard(state, selectedHabitId);
}

export async function createHabit(title: string) {
  const state = await readState();
  const activeCount = activeHabits(state).length;
  const now = new Date().toISOString();
  const habit: HabitRecord = {
    id: state.nextId,
    title: normalizeTitle(title),
    category: inferCategory(title),
    color: defaultColors[activeCount % defaultColors.length],
    sortOrder: activeCount,
    createdAt: now,
  };

  const nextState: HabitState = {
    ...state,
    nextId: state.nextId + 1,
    habits: [...state.habits, habit],
  };

  await writeState(nextState);
  return toDashboard(nextState);
}

export async function updateHabit(id: number, title: string) {
  const normalized = normalizeTitle(title);
  const state = await readState();
  let found = false;
  const habits = state.habits.map((habit) => {
    if (habit.id !== id || habit.archivedAt) return habit;
    found = true;
    return { ...habit, title: normalized, category: inferCategory(normalized) };
  });

  if (!found) throw new Error("수정할 습관이 없어요.");

  const nextState = { ...state, habits };
  await writeState(nextState);
  return toDashboard(nextState, id);
}

export async function archiveHabit(id: number) {
  const state = await readState();
  const habits = state.habits.map((habit) =>
    habit.id === id && !habit.archivedAt ? { ...habit, archivedAt: new Date().toISOString() } : habit,
  );
  const nextState = { ...state, habits };

  await writeState(nextState);
  return toDashboard(nextState);
}

export async function setTodayCheck(habitId: number, isCompleted: boolean) {
  const state = await readState();
  const habit = activeHabits(state).find((item) => item.id === habitId);
  if (!habit) throw new Error("먼저 습관을 만들어주세요.");

  const today = getKstDateString();
  const nextState: HabitState = {
    ...state,
    checks: {
      ...state.checks,
      [habitId]: {
        ...(state.checks[habitId] ?? {}),
        [today]: isCompleted,
      },
    },
  };

  await writeState(nextState);
  return toDashboard(nextState, habitId);
}

async function readState(): Promise<HabitState> {
  const raw = await getStorageItem(STORAGE_KEY);
  if (!raw) return createEmptyState();

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createEmptyState();
  }
}

async function writeState(state: HabitState) {
  await setStorageItem(STORAGE_KEY, JSON.stringify(state));
}

async function getStorageItem(key: string) {
  try {
    return await Storage.getItem(key);
  } catch {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  }
}

async function setStorageItem(key: string, value: string) {
  try {
    await Storage.setItem(key, value);
    return;
  } catch {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
      return;
    }
  }

  throw new Error("저장소에 접근하지 못했어요. 앱을 다시 열어주세요.");
}

function createEmptyState(): HabitState {
  return { version: 1, nextId: 1, habits: [], checks: {} };
}

function normalizeState(value: unknown): HabitState {
  if (!value || typeof value !== "object") return createEmptyState();

  const state = value as Partial<HabitState>;
  const habits = Array.isArray(state.habits) ? state.habits.map(normalizeHabit).filter(isHabitRecord) : [];
  const maxId = habits.reduce((max, habit) => Math.max(max, habit.id), 0);

  return {
    version: 1,
    nextId: typeof state.nextId === "number" && state.nextId > maxId ? state.nextId : maxId + 1,
    habits,
    checks: normalizeChecks(state.checks),
  };
}

function isHabitRecord(value: HabitRecord | null): value is HabitRecord {
  return value !== null;
}

function normalizeHabit(value: unknown): HabitRecord | null {
  if (!value || typeof value !== "object") return null;
  const habit = value as Partial<HabitRecord>;
  if (typeof habit.id !== "number" || typeof habit.title !== "string") return null;

  return {
    id: habit.id,
    title: habit.title.slice(0, 20),
    category: typeof habit.category === "string" ? habit.category : inferCategory(habit.title),
    color: typeof habit.color === "string" ? habit.color : defaultColors[0],
    sortOrder: typeof habit.sortOrder === "number" ? habit.sortOrder : habit.id,
    createdAt: typeof habit.createdAt === "string" ? habit.createdAt : new Date().toISOString(),
    archivedAt: typeof habit.archivedAt === "string" ? habit.archivedAt : undefined,
  };
}

function normalizeChecks(value: unknown): Record<string, Record<string, boolean>> {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, Record<string, boolean>>>((acc, [habitId, checks]) => {
    if (!checks || typeof checks !== "object") return acc;
    acc[habitId] = Object.entries(checks as Record<string, unknown>).reduce<Record<string, boolean>>((dateAcc, [date, completed]) => {
      if (typeof completed === "boolean") dateAcc[date] = completed;
      return dateAcc;
    }, {});
    return acc;
  }, {});
}

function toDashboard(state: HabitState, selectedHabitId: number | "all" = "all"): HabitDashboard {
  const today = getKstDateString();
  const habits = activeHabits(state);
  const summaries = habits.map((habit) => toHabitSummary(habit, state.checks[habit.id] ?? {}, today));
  const selectedId = selectedHabitId !== "all" && summaries.some((habit) => habit.id === selectedHabitId) ? selectedHabitId : "all";
  const todayCompletedCount = summaries.filter((habit) => habit.isTodayCompleted).length;

  return {
    habits: summaries,
    todayDate: today,
    selectedHabitId: selectedId,
    todayCompletedCount,
    totalHabitCount: summaries.length,
    monthGrass: getGrass(state, today, "month", selectedId),
    yearGrass: getGrass(state, today, "year", selectedId),
    pointMission: {
      title: "주간 루틴 보너스",
      description: "이번 주 5일 이상 체크하면 토스 포인트 미션 후보가 돼요. 실제 지급은 앱인토스 프로모션 정책 확인 후 연결합니다.",
      progress: countCompletedDays(state, addDays(today, -6), today, selectedId),
      target: 5,
      status: "concept",
    },
  };
}

function activeHabits(state: HabitState) {
  return [...state.habits]
    .filter((habit) => !habit.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

function toHabitSummary(habit: HabitRecord, checks: Record<string, boolean>, today: string): HabitSummary {
  const completedDates = new Set(Object.entries(checks).filter(([, completed]) => completed).map(([date]) => date));

  return {
    id: habit.id,
    title: habit.title,
    category: habit.category,
    color: habit.color,
    createdAt: habit.createdAt,
    isTodayCompleted: completedDates.has(today),
    streak: calculateStreak(today, completedDates),
    totalCompleted: completedDates.size,
    week: getWeek(today, completedDates),
  };
}

function getGrass(state: HabitState, today: string, range: "month" | "year", selectedHabitId: number | "all") {
  const days = range === "month" ? 35 : 365;
  const start = addDays(today, -(days - 1));

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    const count = countDate(state, date, selectedHabitId);

    return {
      date,
      dayLabel: getDayLabel(date),
      count,
      level: countToLevel(count),
      isToday: date === today,
    };
  });
}

function countCompletedDays(state: HabitState, from: string, to: string, selectedHabitId: number | "all") {
  let count = 0;
  let cursor = from;

  while (cursor <= to) {
    if (countDate(state, cursor, selectedHabitId) > 0) count += 1;
    cursor = addDays(cursor, 1);
  }

  return count;
}

function countDate(state: HabitState, date: string, selectedHabitId: number | "all") {
  const ids = selectedHabitId === "all" ? activeHabits(state).map((habit) => habit.id) : [selectedHabitId];
  return ids.reduce((sum, id) => sum + (state.checks[id]?.[date] ? 1 : 0), 0);
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

function getWeek(today: string, completedDates: Set<string>): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 3);
    return {
      date,
      dayLabel: getDayLabel(date),
      isCompleted: completedDates.has(date),
      isToday: date === today,
    };
  });
}

function countToLevel(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

function normalizeTitle(title: string) {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("습관 이름을 입력해주세요.");
  if (normalized.length > 20) throw new Error("습관 이름은 20자 이내로 적어주세요.");
  return normalized;
}

function inferCategory(title: string) {
  if (/소비|저축|돈|가계|지출|금융|카드|계좌/.test(title)) return "금융";
  if (/운동|걷|물|수면|건강|영양/.test(title)) return "건강";
  if (/책|공부|학습|강의|영어|읽기/.test(title)) return "학습";
  return "생활";
}

function getKstDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
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
