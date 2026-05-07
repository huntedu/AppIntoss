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
        title: "여러 습관을 잔디처럼 쌓아봐요",
        description: "토스에서 오늘 할 작은 루틴을 만들고, 월간·연간 잔디로 이어지는 성취감을 확인해요.",
      };
    }

    if (dashboard.todayCompletedCount === dashboard.totalHabitCount) {
      return {
        eyebrow: "오늘 루틴 완료",
        title: "오늘 습관을 모두 해냈어요",
        description: "작은 체크가 잔디처럼 쌓이고 있어요. 내일도 가볍게 이어가요.",
      };
    }

    return {
      eyebrow: "오늘의 루틴",
      title: `${dashboard.totalHabitCount}개 중 ${dashboard.todayCompletedCount}개 완료`,
      description: "완벽하지 않아도 괜찮아요. 지금 할 수 있는 습관 하나만 체크해요.",
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
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[460px] flex-col">
        <header className="pt-4">
          <p className="text-sm font-bold text-[#3182f6]">{primaryCopy.eyebrow}</p>
          <h1 className="mt-2 text-[32px] font-black leading-tight tracking-[-0.04em]">{primaryCopy.title}</h1>
          <p className="mt-3 text-[16px] leading-7 text-slate-500">{primaryCopy.description}</p>
        </header>

        <div className="mt-8 flex flex-1 flex-col gap-4">
          {isLoading ? (
            <LoadingCard />
          ) : (
            <>
              <Card className="bg-slate-950 text-white ring-0">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-blue-200">오늘 진행률</p>
                    <p className="mt-2 text-4xl font-black tracking-[-0.04em]">{progressRate}%</p>
                  </div>
                  <p className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black">
                    {dashboard.todayCompletedCount}/{dashboard.totalHabitCount || 0} 완료
                  </p>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
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
                    <button disabled={isSaving} className="h-14 rounded-2xl bg-[#3182f6] px-5 font-black text-white disabled:opacity-50">
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
                  {dashboard.habits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
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
                    <h2 className="text-lg font-black">잔디 보기</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {selectedHabit ? selectedHabit.title : "전체 습관"} · {grassRange === "month" ? "이번 달" : "올해"}
                    </p>
                  </div>
                  <select
                    value={selectedHabitId}
                    onChange={(event) => void changeSelectedHabit(event.target.value)}
                    className="h-10 rounded-xl bg-slate-100 px-2 text-sm font-bold outline-none"
                  >
                    <option value="all">전체</option>
                    {dashboard.habits.map((habit) => (
                      <option key={habit.id} value={habit.id}>
                        {habit.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setGrassRange("month")}
                    className={`h-10 rounded-xl text-sm font-black ${grassRange === "month" ? "bg-white text-[#3182f6] shadow-sm" : "text-slate-500"}`}
                  >
                    한달
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrassRange("year")}
                    className={`h-10 rounded-xl text-sm font-black ${grassRange === "year" ? "bg-white text-[#3182f6] shadow-sm" : "text-slate-500"}`}
                  >
                    1년
                  </button>
                </div>

                <GrassHeatmap days={activeGrass} range={grassRange} />
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
      </section>
    </main>
  );
}

function HabitCard({ habit, onToggle, onRename, onArchive }: { habit: HabitSummary; onToggle: () => void; onRename: () => void; onArchive: () => void }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: habit.color }} />
            <p className="text-xs font-black text-slate-400">{habit.category}</p>
          </div>
          <h2 className="mt-2 truncate text-xl font-black tracking-[-0.03em]">{habit.title}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">🔥 {habit.streak}일 연속 · 총 {habit.totalCompleted}번</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
            habit.isTodayCompleted ? "bg-[#3182f6] text-white" : "bg-slate-100 text-slate-700"
          }`}
          aria-pressed={habit.isTodayCompleted}
        >
          {habit.isTodayCompleted ? "완료" : "체크"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {habit.week.map((day) => (
          <div key={day.date} className="text-center">
            <p className={`text-[11px] font-bold ${day.isToday ? "text-[#3182f6]" : "text-slate-400"}`}>{day.dayLabel}</p>
            <div
              className={`mt-1 flex aspect-square items-center justify-center rounded-xl text-xs font-black ${
                day.isCompleted ? "bg-[#3182f6] text-white" : day.isToday ? "bg-blue-50 text-[#3182f6] ring-1 ring-blue-100" : "bg-slate-100 text-slate-300"
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
    </Card>
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
            className={`flex items-center justify-center rounded-md text-[10px] font-black ${grassClass(day.level, day.isToday)} ${range === "month" ? "aspect-square" : "h-3.5 w-3.5"}`}
          >
            {range === "month" ? new Date(`${day.date}T00:00:00.000Z`).getUTCDate() : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] font-bold text-slate-400">
        <span>적음</span>
        {[0, 1, 2, 3].map((level) => (
          <span key={level} className={`h-3 w-3 rounded ${grassClass(level, false)}`} />
        ))}
        <span>많음</span>
      </div>
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
