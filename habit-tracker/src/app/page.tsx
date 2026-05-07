"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type WeekDay = {
  date: string;
  dayLabel: string;
  isCompleted: boolean;
  isToday: boolean;
};

type HabitSnapshot = {
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

const emptySnapshot: HabitSnapshot = {
  habit: null,
  todayDate: "",
  isTodayCompleted: false,
  streak: 0,
  totalCompleted: 0,
  week: [],
};

const suggestions = ["물 한 잔 마시기", "10분 걷기", "소비 내역 확인하기", "책 5쪽 읽기"];

export default function Home() {
  const [snapshot, setSnapshot] = useState<HabitSnapshot>(emptySnapshot);
  const [title, setTitle] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const primaryCopy = useMemo(() => {
    if (!snapshot.habit) {
      return {
        eyebrow: "오늘습관",
        title: "작은 습관 하나부터 시작해볼까요?",
        description: "너무 큰 목표보다, 매일 할 수 있는 한 가지가 좋아요.",
      };
    }

    if (snapshot.isTodayCompleted) {
      return {
        eyebrow: "오늘도 성공",
        title: "오늘도 해냈어요",
        description: "작은 완료가 쌓이고 있어요. 내일도 가볍게 이어가요.",
      };
    }

    return {
      eyebrow: "오늘의 습관",
      title: "오늘 하나만 해도 충분해요",
      description: "했다면 지금 체크해보세요. 3초면 끝나요.",
    };
  }, [snapshot.habit, snapshot.isTodayCompleted]);

  const requestSnapshot = useCallback(async (path: string, init?: RequestInit) => {
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

    setSnapshot(data);
    return data as HabitSnapshot;
  }, []);

  const refreshSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      await requestSnapshot("/api/habit");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "습관 정보를 불러오지 못했어요.");
    } finally {
      setIsLoading(false);
    }
  }, [requestSnapshot]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSnapshot();
    });
  }, [refreshSnapshot]);

  async function createHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveHabit(title, "POST");
    setTitle("");
  }

  async function updateHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveHabit(draftTitle, "PATCH");
    setIsEditing(false);
  }

  async function saveHabit(value: string, method: "POST" | "PATCH") {
    try {
      setIsSaving(true);
      setError("");
      await requestSnapshot("/api/habit", {
        method,
        body: JSON.stringify({ title: value }),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "잠시 후 다시 시도해주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleTodayCheck() {
    if (!snapshot.habit) {
      return;
    }

    const previousSnapshot = snapshot;
    const nextCompleted = !snapshot.isTodayCompleted;

    setSnapshot({
      ...snapshot,
      isTodayCompleted: nextCompleted,
      streak: nextCompleted ? Math.max(1, snapshot.streak || 0) : 0,
      totalCompleted: Math.max(0, snapshot.totalCompleted + (nextCompleted ? 1 : -1)),
      week: snapshot.week.map((day) => (day.isToday ? { ...day, isCompleted: nextCompleted } : day)),
    });

    try {
      setError("");
      await requestSnapshot("/api/check/today", {
        method: "PUT",
        body: JSON.stringify({ isCompleted: nextCompleted }),
      });
    } catch (toggleError) {
      setSnapshot(previousSnapshot);
      setError(toggleError instanceof Error ? toggleError.message : "오늘 체크에 실패했어요.");
    }
  }

  async function resetHabit() {
    if (!window.confirm("이 습관 기록을 중단할까요? 언제든 새로 시작할 수 있어요.")) {
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      await requestSnapshot("/api/habit", { method: "DELETE" });
      setIsEditing(false);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "습관을 중단하지 못했어요.");
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit() {
    setDraftTitle(snapshot.habit?.title ?? "");
    setIsEditing(true);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[430px] flex-col">
        <header className="pt-4">
          <p className="text-sm font-bold text-[#3182f6]">{primaryCopy.eyebrow}</p>
          <h1 className="mt-2 text-[32px] font-black leading-tight tracking-[-0.04em]">{primaryCopy.title}</h1>
          <p className="mt-3 text-[16px] leading-7 text-slate-500">{primaryCopy.description}</p>
        </header>

        <div className="mt-8 flex flex-1 flex-col gap-4">
          {isLoading ? (
            <Card>
              <div className="h-5 w-28 animate-pulse rounded-full bg-slate-100" />
              <div className="mt-4 h-9 w-48 animate-pulse rounded-2xl bg-slate-100" />
              <div className="mt-8 h-14 w-full animate-pulse rounded-3xl bg-slate-100" />
            </Card>
          ) : snapshot.habit ? (
            <>
              <Card className="overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-400">오늘의 습관</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">{snapshot.habit.title}</h2>
                  </div>
                  <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right">
                    <p className="text-xs font-bold text-[#3182f6]">연속</p>
                    <p className="text-lg font-black text-[#1b64da]">{snapshot.streak}일</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleTodayCheck}
                  className={`mt-8 flex min-h-20 w-full items-center justify-center rounded-[28px] px-6 text-lg font-black shadow-sm transition active:scale-[0.98] ${
                    snapshot.isTodayCompleted
                      ? "bg-[#3182f6] text-white shadow-blue-200"
                      : "bg-slate-950 text-white shadow-slate-200"
                  }`}
                  aria-pressed={snapshot.isTodayCompleted}
                >
                  <span className="mr-2 text-2xl" aria-hidden="true">
                    {snapshot.isTodayCompleted ? "✓" : "○"}
                  </span>
                  {snapshot.isTodayCompleted ? "오늘도 해냈어요" : "오늘 완료하기"}
                </button>

                <p className="mt-4 text-center text-sm font-semibold text-slate-500">
                  {snapshot.isTodayCompleted
                    ? `${snapshot.totalCompleted}번의 작은 성공이 쌓였어요.`
                    : "완벽하지 않아도 괜찮아요. 오늘부터 다시 시작해요."}
                </p>
              </Card>

              <Card>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black">이번 주</h3>
                  <p className="text-sm font-semibold text-slate-400">한국 시간 기준</p>
                </div>
                <div className="mt-5 grid grid-cols-7 gap-2">
                  {snapshot.week.map((day) => (
                    <div key={day.date} className="text-center">
                      <p className={`text-xs font-bold ${day.isToday ? "text-[#3182f6]" : "text-slate-400"}`}>{day.dayLabel}</p>
                      <div
                        className={`mt-2 flex aspect-square items-center justify-center rounded-2xl text-sm font-black ${
                          day.isCompleted
                            ? "bg-[#3182f6] text-white"
                            : day.isToday
                              ? "bg-blue-50 text-[#3182f6] ring-1 ring-blue-100"
                              : "bg-slate-100 text-slate-300"
                        }`}
                        title={day.date}
                      >
                        {day.isCompleted ? "✓" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                {isEditing ? (
                  <form onSubmit={updateHabit} className="space-y-3">
                    <label className="block text-sm font-bold text-slate-500" htmlFor="edit-habit">
                      습관 이름 수정
                    </label>
                    <input
                      id="edit-habit"
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      maxLength={20}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-bold outline-none transition focus:border-[#3182f6] focus:ring-4 focus:ring-blue-100"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button className="h-12 rounded-2xl bg-[#3182f6] font-black text-white" disabled={isSaving}>
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="h-12 rounded-2xl bg-slate-100 font-black text-slate-600"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={startEdit} className="font-bold text-slate-500 underline-offset-4 hover:underline">
                      습관 수정
                    </button>
                    <button type="button" onClick={resetHabit} className="font-bold text-slate-400 underline-offset-4 hover:underline">
                      그만하기
                    </button>
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card>
              <form onSubmit={createHabit} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-slate-500" htmlFor="habit-title">
                    매일 할 수 있는 작은 습관
                  </label>
                  <input
                    id="habit-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={20}
                    placeholder="예: 물 한 잔 마시기"
                    className="mt-2 h-16 w-full rounded-3xl border border-slate-200 bg-white px-5 text-lg font-bold outline-none transition placeholder:text-slate-300 focus:border-[#3182f6] focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setTitle(suggestion)}
                      className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-blue-50 hover:text-[#3182f6]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <button
                  disabled={isSaving}
                  className="h-16 w-full rounded-[28px] bg-[#3182f6] text-lg font-black text-white shadow-lg shadow-blue-100 transition active:scale-[0.98] disabled:opacity-50"
                >
                  습관 만들기
                </button>
              </form>
            </Card>
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-slate-100 ${className}`}>{children}</div>;
}
