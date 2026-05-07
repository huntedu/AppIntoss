"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type WeekDay = {
  date: string;
  dayLabel: string;
  isCompleted: boolean;
  isToday: boolean;
};

type GrassDay = {
  date: string;
  dayLabel: string;
  count: number;
  level: number;
  isToday: boolean;
};

type HabitSummary = {
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

type HabitDashboard = {
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

const emptyDashboard: HabitDashboard = {
  habits: [],
  todayDate: "",
  selectedHabitId: "all",
  todayCompletedCount: 0,
  totalHabitCount: 0,
  monthGrass: [],
  yearGrass: [],
  pointMission: {
    title: "주간 루틴 보너스",
    description: "앱인토스 포인트 프로모션 검토 전까지는 컨셉으로 표시해요.",
    progress: 0,
    target: 5,
    status: "concept",
  },
};

const suggestions = ["소비 내역 확인하기", "불필요한 소비 안 하기", "물 한 잔 마시기", "10분 걷기", "책 5쪽 읽기"];
const cardTints = ["bg-blue-50", "bg-emerald-50", "bg-violet-50", "bg-orange-50", "bg-rose-50"];
const navItems = [
  { icon: "＋", label: "추가" },
  { icon: "⌂", label: "오늘" },
  { icon: "▦", label: "잔디" },
  { icon: "★", label: "포인트" },
];

export default function Home() {
  const [dashboard, setDashboard] = useState<HabitDashboard>(emptyDashboard);
  const [title, setTitle] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState<number | "all">("all");
  const [grassRange, setGrassRange] = useState<"month" | "year">("month");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedHabit = dashboard.habits.find((habit) => habit.id === selectedHabitId);
  const activeGrass = grassRange === "month" ? dashboard.monthGrass : dashboard.yearGrass;
  const progressRate = dashboard.totalHabitCount ? Math.round((dashboard.todayCompletedCount / dashboard.totalHabitCount) * 100) : 0;

  const primaryCopy = useMemo(() => {
    if (dashboard.totalHabitCount === 0) {
      return {
        eyebrow: "오늘습관",
        title: "Build Habits",
        description: "토스에서 오늘 할 작은 루틴을 만들고, 잔디처럼 성취를 쌓아봐요.",
      };
    }

    if (dashboard.todayCompletedCount === dashboard.totalHabitCount) {
      return {
        eyebrow: "오늘 루틴 완료",
        title: "Today",
        description: "오늘 습관을 모두 해냈어요. 작은 체크가 잔디처럼 쌓이고 있어요.",
      };
    }

    return {
      eyebrow: "오늘의 루틴",
      title: "Today",
      description: `${dashboard.totalHabitCount}개 중 ${dashboard.todayCompletedCount}개 완료했어요. 지금 할 수 있는 습관 하나만 체크해요.`,
    };
  }, [dashboard.todayCompletedCount, dashboard.totalHabitCount]);

  const requestDashboard = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "잠시 후 다시 시도해주세요.");
    }

    setDashboard(data);
    setSelectedHabitId(data.selectedHabitId ?? "all");
    return data as HabitDashboard;
  }, []);

  const refreshDashboard = useCallback(
    async (habitId: number | "all") => {
      try {
        setIsLoading(true);
        setError("");
        await requestDashboard(`/api/habit?habitId=${habitId}`);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "습관 정보를 불러오지 못했어요.");
      } finally {
        setIsLoading(false);
      }
    },
    [requestDashboard],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void refreshDashboard("all");
    });
  }, [refreshDashboard]);

  async function createHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate(async () => {
      await requestDashboard("/api/habit", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setTitle("");
    });
  }

  async function toggleTodayCheck(habit: HabitSummary) {
    const previous = dashboard;
    const nextCompleted = !habit.isTodayCompleted;

    setDashboard({
      ...dashboard,
      todayCompletedCount: Math.max(0, dashboard.todayCompletedCount + (nextCompleted ? 1 : -1)),
      habits: dashboard.habits.map((item) =>
        item.id === habit.id
          ? {
              ...item,
              isTodayCompleted: nextCompleted,
              streak: nextCompleted ? Math.max(1, item.streak || 0) : 0,
              totalCompleted: Math.max(0, item.totalCompleted + (nextCompleted ? 1 : -1)),
              week: item.week.map((day) => (day.isToday ? { ...day, isCompleted: nextCompleted } : day)),
            }
          : item,
      ),
    });

    try {
      setError("");
      await requestDashboard("/api/check/today", {
        method: "PUT",
        body: JSON.stringify({ habitId: habit.id, isCompleted: nextCompleted }),
      });
    } catch (toggleError) {
      setDashboard(previous);
      setError(toggleError instanceof Error ? toggleError.message : "오늘 체크에 실패했어요.");
    }
  }

  async function renameHabit(habit: HabitSummary) {
    const nextTitle = window.prompt("습관 이름을 수정해주세요.", habit.title);

    if (nextTitle === null || nextTitle === habit.title) {
      return;
    }

    await mutate(async () => {
      await requestDashboard("/api/habit", {
        method: "PATCH",
        body: JSON.stringify({ id: habit.id, title: nextTitle }),
      });
    });
  }

  async function archiveHabit(habit: HabitSummary) {
    if (!window.confirm(`'${habit.title}' 습관을 중단할까요? 기록은 숨겨지고 새로 시작할 수 있어요.`)) {
      return;
    }

    await mutate(async () => {
      await requestDashboard("/api/habit", {
        method: "DELETE",
        body: JSON.stringify({ id: habit.id }),
      });
    });
  }

  async function changeSelectedHabit(value: string) {
    const nextId = value === "all" ? "all" : Number(value);
    setSelectedHabitId(nextId);
    await refreshDashboard(nextId);
  }

  async function mutate(action: () => Promise<void>) {
    try {
      setIsSaving(true);
      setError("");
      await action();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-5 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[460px] flex-col pb-24">
        <TopBar title={primaryCopy.title} />

        <header className="pt-4">
          <p className="text-sm font-bold text-[#3182f6]">{primaryCopy.eyebrow}</p>
          <h1 className="mt-2 text-[32px] font-black leading-tight tracking-[-0.04em]">{primaryCopy.title}</h1>
          <p className="mt-3 text-[16px] leading-7 text-slate-500">{primaryCopy.description}</p>
        </header>

        <DateStrip days={dashboard.habits[0]?.week ?? []} todayDate={dashboard.todayDate} />

        <div className="mt-6 flex flex-1 flex-col gap-4">
          {isLoading ? (
            <LoadingCard />
          ) : (
            <>
              <Card className="bg-white/90">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-400">Daily Progress</p>
                    <p className="mt-1 text-4xl font-black tracking-[-0.05em]">{progressRate}%</p>
                  </div>
                  <div className="rounded-3xl bg-blue-50 px-4 py-3 text-right">
                    <p className="text-xs font-black text-[#3182f6]">오늘 완료</p>
                    <p className="text-lg font-black text-[#1b64da]">
                      {dashboard.todayCompletedCount}/{dashboard.totalHabitCount || 0}
                    </p>
                  </div>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#3182f6] transition-all" style={{ width: `${progressRate}%` }} />
                </div>
              </Card>

              <Card>
                <form onSubmit={createHabit} className="space-y-4">
                  <label className="text-sm font-bold text-slate-500" htmlFor="habit-title">
                    새 습관 추가
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="habit-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={20}
                      placeholder="예: 소비 내역 확인하기"
                      className="h-14 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold outline-none transition placeholder:text-slate-300 focus:border-[#3182f6] focus:ring-4 focus:ring-blue-100"
                    />
                    <button disabled={isSaving} className="h-14 rounded-2xl bg-[#3182f6] px-5 font-black text-white shadow-lg shadow-blue-100 disabled:opacity-50">
                      추가
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setTitle(suggestion)}
                        className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-blue-50 hover:text-[#3182f6]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </form>
              </Card>

              {dashboard.habits.length ? (
                <div className="space-y-3">
                  {dashboard.habits.map((habit, index) => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      tint={cardTints[index % cardTints.length]}
                      onToggle={() => void toggleTodayCheck(habit)}
                      onRename={() => void renameHabit(habit)}
                      onArchive={() => void archiveHabit(habit)}
                    />
                  ))}
                </div>
              ) : (
                <Card>
                  <p className="text-lg font-black">아직 등록된 습관이 없어요</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">토스에서 자주 확인하기 좋은 금융 루틴이나, 매일 3초면 되는 작은 습관부터 추가해보세요.</p>
                </Card>
              )}

              <Card>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#3182f6]">Habit Reports</p>
                    <h2 className="mt-1 text-xl font-black">잔디 보기</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {selectedHabit ? selectedHabit.title : "전체 습관"} · {grassRange === "month" ? "Monthly" : "Yearly"}
                    </p>
                  </div>
                  <select
                    value={selectedHabitId}
                    onChange={(event) => void changeSelectedHabit(event.target.value)}
                    className="h-10 rounded-full bg-slate-100 px-3 text-sm font-bold outline-none"
                  >
                    <option value="all">All</option>
                    {dashboard.habits.map((habit) => (
                      <option key={habit.id} value={habit.id}>
                        {habit.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 flex gap-6 border-b border-slate-100 text-sm font-black">
                  {(["month", "year"] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setGrassRange(range)}
                      className={`border-b-2 pb-3 transition ${grassRange === range ? "border-[#3182f6] text-[#3182f6]" : "border-transparent text-slate-400"}`}
                    >
                      {range === "month" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>

                <GrassHeatmap days={activeGrass} range={grassRange} />

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <StatPill value={dashboard.todayCompletedCount} label="Met" />
                  <StatPill value={dashboard.totalHabitCount} label="Habits" />
                  <StatPill value={selectedHabit?.streak ?? 0} label="Best Streak" />
                </div>
              </Card>

              <Card className="bg-blue-50 ring-blue-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#3182f6]">앱인토스 포인트 구상</p>
                    <h2 className="mt-2 text-xl font-black">{dashboard.pointMission.title}</h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{dashboard.pointMission.description}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#3182f6]">컨셉</span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#3182f6] transition-all"
                    style={{ width: `${Math.min(100, (dashboard.pointMission.progress / dashboard.pointMission.target) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  이번 주 {dashboard.pointMission.progress}/{dashboard.pointMission.target}일 체크
                </p>
              </Card>
            </>
          )}

          {error ? (
            <div className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-bold text-red-600" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <BottomNav />
      </section>
    </main>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <div className="grid grid-cols-3 items-center pt-1">
      <button className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-slate-500 shadow-sm ring-1 ring-slate-100">All</button>
      <p className="text-center text-lg font-black tracking-[-0.03em]">{title}</p>
      <div className="justify-self-end rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-lg">🧭</div>
      </div>
    </div>
  );
}

function DateStrip({ days, todayDate }: { days: WeekDay[]; todayDate: string }) {
  const fallbackDays = useMemo(() => makeFallbackDays(todayDate), [todayDate]);
  const visibleDays = days.length ? days : fallbackDays;

  return (
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
      {visibleDays.map((day) => (
        <div key={day.date} className={`flex min-w-14 flex-col items-center rounded-3xl px-3 py-3 ${day.isToday ? "bg-[#3182f6] text-white" : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-100"}`}>
          <p className="text-xs font-black opacity-80">{day.dayLabel}</p>
          <p className="mt-1 text-lg font-black">{Number(day.date.slice(8, 10)) || ""}</p>
        </div>
      ))}
    </div>
  );
}

function HabitCard({ habit, tint, onToggle, onRename, onArchive }: { habit: HabitSummary; tint: string; onToggle: () => void; onRename: () => void; onArchive: () => void }) {
  return (
    <div className={`rounded-[30px] p-5 shadow-sm ring-1 ring-white/80 ${tint}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">{emojiForHabit(habit)}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
              <p className="text-xs font-black text-slate-400">{habit.category}</p>
            </div>
            <h2 className="mt-1 truncate text-xl font-black tracking-[-0.03em]">{habit.title}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{habit.totalCompleted} total done</p>
          </div>
        </div>
        <div className="text-right">
          <p className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-slate-600">{habit.streak} Days</p>
          <button
            type="button"
            onClick={onToggle}
            className={`mt-3 flex h-11 w-11 items-center justify-center rounded-full text-lg font-black shadow-sm transition active:scale-[0.96] ${
              habit.isTodayCompleted ? "bg-[#3182f6] text-white" : "bg-white text-slate-300"
            }`}
            aria-pressed={habit.isTodayCompleted}
          >
            {habit.isTodayCompleted ? "✓" : "+"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {habit.week.map((day) => (
          <div key={day.date} className="text-center">
            <p className={`text-[11px] font-bold ${day.isToday ? "text-[#3182f6]" : "text-slate-400"}`}>{day.dayLabel}</p>
            <div
              className={`mt-1 flex aspect-square items-center justify-center rounded-full text-xs font-black ${
                day.isCompleted ? "bg-[#3182f6] text-white" : day.isToday ? "bg-white text-[#3182f6] ring-2 ring-blue-100" : "bg-white/70 text-slate-300"
              }`}
              title={day.date}
            >
              {day.isCompleted ? "✓" : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-4 text-sm font-bold">
        <button type="button" onClick={onRename} className="text-slate-500 underline-offset-4 hover:underline">
          수정
        </button>
        <button type="button" onClick={onArchive} className="text-slate-400 underline-offset-4 hover:underline">
          중단
        </button>
      </div>
    </div>
  );
}

function GrassHeatmap({ days, range }: { days: GrassDay[]; range: "month" | "year" }) {
  return (
    <div className="mt-5 overflow-x-auto pb-2">
      <div className={range === "month" ? "grid min-w-full grid-cols-7 gap-1.5" : "grid w-max grid-flow-col grid-rows-7 gap-1.5"}>
        {days.map((day) => (
          <div
            key={day.date}
            title={`${day.date} · ${day.count}개 완료`}
            className={`flex items-center justify-center rounded-lg text-[10px] font-black ${grassClass(day.level, day.isToday)} ${range === "month" ? "aspect-square" : "h-3.5 w-3.5"}`}
          >
            {range === "month" ? new Date(`${day.date}T00:00:00.000Z`).getUTCDate() : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-bold text-slate-400">
        <span>Less</span>
        {[0, 1, 2, 3].map((level) => (
          <span key={level} className={`h-3 w-3 rounded ${grassClass(level, false)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-white/90 p-2 shadow-2xl shadow-slate-300/40 ring-1 ring-slate-100 backdrop-blur">
      {navItems.map((item, index) => (
        <button
          key={item.label}
          type="button"
          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-black transition ${index === 1 ? "bg-[#3182f6] text-white" : "text-slate-400 hover:bg-slate-100"}`}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </nav>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
      <p className="text-xl font-black text-[#3182f6]">{value}</p>
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
    </div>
  );
}

function grassClass(level: number, isToday: boolean) {
  const base = isToday ? "ring-2 ring-[#3182f6] ring-offset-1 " : "";

  if (level === 0) return `${base}bg-slate-100 text-slate-300`;
  if (level === 1) return `${base}bg-blue-100 text-[#3182f6]`;
  if (level === 2) return `${base}bg-blue-300 text-white`;
  return `${base}bg-[#3182f6] text-white`;
}

function emojiForHabit(habit: HabitSummary) {
  if (habit.category === "금융") return "💰";
  if (habit.category === "건강") return "💧";
  if (habit.category === "학습") return "📚";
  return "✨";
}

function makeFallbackDays(todayDate: string) {
  if (!todayDate) return [];

  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${todayDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index - 3);
    const dateString = date.toISOString().slice(0, 10);

    return {
      date: dateString,
      dayLabel: labels[date.getUTCDay()],
      isCompleted: false,
      isToday: dateString === todayDate,
    };
  });
}

function LoadingCard() {
  return (
    <Card>
      <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
      <div className="mt-4 h-9 w-48 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-8 h-14 w-full animate-pulse rounded-3xl bg-slate-100" />
    </Card>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-slate-100 ${className}`}>{children}</div>;
}
