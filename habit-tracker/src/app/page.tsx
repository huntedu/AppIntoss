"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import {
  archiveHabit as archiveHabitInStore,
  createHabit as createHabitInStore,
  loadHabitDashboard,
  setTodayCheck,
  updateHabit as updateHabitInStore,
  type GrassDay,
  type HabitDashboard,
  type HabitSummary,
  type WeekDay,
} from "@/lib/habit-client-store";

type TabKey = "add" | "today" | "grass" | "points" | "benefits";

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
const financeSuggestions = ["소비 내역 확인하기", "저축 목표 보기", "불필요한 소비 안 하기"];
const cardTints = ["bg-blue-50", "bg-emerald-50", "bg-violet-50", "bg-orange-50", "bg-rose-50"];
const navItems: { key: TabKey; icon: string; label: string }[] = [
  { key: "add", icon: "＋", label: "추가" },
  { key: "today", icon: "⌂", label: "오늘" },
  { key: "grass", icon: "▦", label: "잔디" },
  { key: "points", icon: "★", label: "포인트" },
  { key: "benefits", icon: "◇", label: "장점" },
];

export default function Home() {
  const [dashboard, setDashboard] = useState<HabitDashboard>(emptyDashboard);
  const [title, setTitle] = useState("");
  const [selectedHabitId, setSelectedHabitId] = useState<number | "all">("all");
  const [grassRange, setGrassRange] = useState<"month" | "year">("month");
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [showPointRules, setShowPointRules] = useState(false);
  const [showAdvantageDetail, setShowAdvantageDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedHabit = dashboard.habits.find((habit) => habit.id === selectedHabitId);
  const activeGrass = grassRange === "month" ? dashboard.monthGrass : dashboard.yearGrass;
  const progressRate = dashboard.totalHabitCount ? Math.round((dashboard.todayCompletedCount / dashboard.totalHabitCount) * 100) : 0;
  const bestStreak = dashboard.habits.reduce((max, habit) => Math.max(max, habit.streak), 0);
  const totalDone = dashboard.habits.reduce((sum, habit) => sum + habit.totalCompleted, 0);

  const primaryCopy = useMemo(() => {
    if (activeTab === "add") {
      return {
        eyebrow: "Build Habits",
        title: "새 습관 추가",
        description: "토스에서 자주 확인하기 좋은 금융 루틴이나, 매일 3초면 되는 작은 습관을 추가해요.",
      };
    }

    if (activeTab === "grass") {
      return {
        eyebrow: "Habit Reports",
        title: "잔디 보기",
        description: "한달과 1년의 체크 기록을 잔디처럼 확인하고, 전체 또는 습관별로 비교해요.",
      };
    }

    if (activeTab === "points") {
      return {
        eyebrow: "Toss Point Concept",
        title: "포인트 미션",
        description: "모든 체크에 보상하지 않고, 주간 루틴처럼 의미 있는 지속 행동에 보너스를 연결해요.",
      };
    }

    if (activeTab === "benefits") {
      return {
        eyebrow: "오늘습관만의 장점",
        title: "토스에서 바로 하는 루틴",
        description: "돈 관리 습관과 일상 루틴을 한 화면에서 체크하고, 잔디와 포인트 미션으로 다시 오게 만들어요.",
      };
    }

    if (dashboard.totalHabitCount === 0) {
      return {
        eyebrow: "오늘습관",
        title: "Today",
        description: "아직 습관이 없어요. 아래 탭에서 첫 습관을 추가해보세요.",
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
  }, [activeTab, dashboard.todayCompletedCount, dashboard.totalHabitCount]);

  const applyDashboard = useCallback((data: HabitDashboard) => {
    setDashboard(data);
    setSelectedHabitId(data.selectedHabitId ?? "all");
    return data;
  }, []);

  const refreshDashboard = useCallback(
    async (habitId: number | "all") => {
      try {
        setIsLoading(true);
        setError("");
        applyDashboard(await loadHabitDashboard(habitId));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "습관 정보를 불러오지 못했어요.");
      } finally {
        setIsLoading(false);
      }
    },
    [applyDashboard],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void refreshDashboard("all");
    });
  }, [refreshDashboard]);

  async function createHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createHabitFromTitle(title);
  }

  async function createHabitFromTitle(nextTitle: string) {
    await mutate(async () => {
      applyDashboard(await createHabitInStore(nextTitle));
      await safeHaptic("tap");
      setTitle("");
      setActiveTab("today");
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
      applyDashboard(await setTodayCheck(habit.id, nextCompleted));
      await safeHaptic(nextCompleted ? "success" : "tickWeak");
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
      applyDashboard(await updateHabitInStore(habit.id, nextTitle));
      await safeHaptic("tap");
    });
  }

  async function archiveHabit(habit: HabitSummary) {
    if (!window.confirm(`'${habit.title}' 습관을 중단할까요? 기록은 숨겨지고 새로 시작할 수 있어요.`)) {
      return;
    }

    await mutate(async () => {
      applyDashboard(await archiveHabitInStore(habit.id));
      await safeHaptic("tickWeak");
    });
  }

  async function changeSelectedHabit(value: string) {
    const nextId = value === "all" ? "all" : Number(value);
    setSelectedHabitId(nextId);
    await refreshDashboard(nextId);
  }

  async function showAllHabits() {
    setSelectedHabitId("all");
    setActiveTab("today");
    await refreshDashboard("all");
  }

  function startFinancePreset(preset: string) {
    setTitle(preset);
    setActiveTab("add");
  }

  function selectTab(tab: TabKey) {
    setActiveTab(tab);
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
        <TopBar title={primaryCopy.title} onShowAll={() => void showAllHabits()} onOpenBenefits={() => setActiveTab("benefits")} />

        <header className="pt-4">
          <p className="text-sm font-bold text-[#3182f6]">{primaryCopy.eyebrow}</p>
          <h1 className="mt-2 text-[32px] font-black leading-tight tracking-[-0.04em]">{primaryCopy.title}</h1>
          <p className="mt-3 text-[16px] leading-7 text-slate-500">{primaryCopy.description}</p>
        </header>

        <DateStrip days={dashboard.habits[0]?.week ?? []} todayDate={dashboard.todayDate} onOpenGrass={() => setActiveTab("grass")} />

        <div className="mt-6 flex flex-1 flex-col gap-4">
          {isLoading ? <LoadingCard /> : null}
          {!isLoading && activeTab === "add" ? (
            <AddView title={title} setTitle={setTitle} isSaving={isSaving} onCreate={createHabit} onUseSuggestion={setTitle} onQuickCreate={(preset) => void createHabitFromTitle(preset)} />
          ) : null}
          {!isLoading && activeTab === "today" ? (
            <TodayView
              dashboard={dashboard}
              progressRate={progressRate}
              onAdd={() => setActiveTab("add")}
              onToggle={toggleTodayCheck}
              onRename={renameHabit}
              onArchive={archiveHabit}
            />
          ) : null}
          {!isLoading && activeTab === "grass" ? (
            <GrassView
              dashboard={dashboard}
              selectedHabit={selectedHabit}
              selectedHabitId={selectedHabitId}
              grassRange={grassRange}
              activeGrass={activeGrass}
              bestStreak={bestStreak}
              totalDone={totalDone}
              onChangeHabit={(value) => void changeSelectedHabit(value)}
              onChangeRange={setGrassRange}
            />
          ) : null}
          {!isLoading && activeTab === "points" ? (
            <PointView dashboard={dashboard} showPointRules={showPointRules} onToggleRules={() => setShowPointRules((value) => !value)} onOpenGrass={() => setActiveTab("grass")} />
          ) : null}
          {!isLoading && activeTab === "benefits" ? (
            <BenefitsView showDetail={showAdvantageDetail} onToggleDetail={() => setShowAdvantageDetail((value) => !value)} onUsePreset={startFinancePreset} />
          ) : null}

          {error ? (
            <div className="rounded-3xl bg-red-50 px-5 py-4 text-sm font-bold text-red-600" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <BottomNav activeTab={activeTab} onSelect={selectTab} />
      </section>
    </main>
  );
}

async function safeHaptic(type: "tap" | "success" | "tickWeak") {
  try {
    await generateHapticFeedback({ type });
  } catch {
    // 일반 브라우저와 일부 샌드박스에서는 Toss bridge가 없을 수 있습니다.
  }
}

function TopBar({ title, onShowAll, onOpenBenefits }: { title: string; onShowAll: () => void; onOpenBenefits: () => void }) {
  return (
    <div className="grid grid-cols-3 items-center pt-1">
      <button type="button" onClick={onShowAll} className="w-fit rounded-full bg-white px-4 py-2 text-sm font-black text-slate-500 shadow-sm ring-1 ring-slate-100">
        All
      </button>
      <p className="text-center text-lg font-black tracking-[-0.03em]">{title}</p>
      <button type="button" onClick={onOpenBenefits} className="justify-self-end rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-100" aria-label="오늘습관 장점 보기">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-lg">🧭</span>
      </button>
    </div>
  );
}

function DateStrip({ days, todayDate, onOpenGrass }: { days: WeekDay[]; todayDate: string; onOpenGrass: () => void }) {
  const fallbackDays = useMemo(() => makeFallbackDays(todayDate), [todayDate]);
  const visibleDays = days.length ? days : fallbackDays;

  return (
    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
      {visibleDays.map((day) => (
        <button
          key={day.date}
          type="button"
          onClick={onOpenGrass}
          className={`flex min-w-14 flex-col items-center rounded-3xl px-3 py-3 ${day.isToday ? "bg-[#3182f6] text-white" : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-100"}`}
          title={`${day.date} 잔디 보기`}
        >
          <span className="text-xs font-black opacity-80">{day.dayLabel}</span>
          <span className="mt-1 text-lg font-black">{Number(day.date.slice(8, 10)) || ""}</span>
        </button>
      ))}
    </div>
  );
}

function AddView({ title, setTitle, isSaving, onCreate, onUseSuggestion, onQuickCreate }: { title: string; setTitle: (value: string) => void; isSaving: boolean; onCreate: (event: FormEvent<HTMLFormElement>) => void; onUseSuggestion: (value: string) => void; onQuickCreate: (value: string) => void }) {
  return (
    <>
      <Card>
        <form onSubmit={onCreate} className="space-y-4">
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
                onClick={() => onUseSuggestion(suggestion)}
                className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-blue-50 hover:text-[#3182f6]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      </Card>

      <Card className="bg-blue-50 ring-blue-100">
        <p className="text-sm font-black text-[#3182f6]">토스에 잘 맞는 추천 루틴</p>
        <h2 className="mt-2 text-xl font-black">금융 습관부터 빠르게 시작</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">오늘습관의 차별점은 돈 관리 습관을 토스 진입 맥락에서 바로 체크하게 만드는 거예요.</p>
        <div className="mt-4 grid gap-2">
          {financeSuggestions.map((preset) => (
            <button key={preset} type="button" onClick={() => onQuickCreate(preset)} className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-black text-slate-700 shadow-sm">
              + {preset}
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}

function TodayView({ dashboard, progressRate, onAdd, onToggle, onRename, onArchive }: { dashboard: HabitDashboard; progressRate: number; onAdd: () => void; onToggle: (habit: HabitSummary) => void; onRename: (habit: HabitSummary) => void; onArchive: (habit: HabitSummary) => void }) {
  return (
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

      {dashboard.habits.length ? (
        <div className="space-y-3">
          {dashboard.habits.map((habit, index) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              tint={cardTints[index % cardTints.length]}
              onToggle={() => void onToggle(habit)}
              onRename={() => void onRename(habit)}
              onArchive={() => void onArchive(habit)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-lg font-black">아직 등록된 습관이 없어요</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">토스에서 자주 확인하기 좋은 금융 루틴이나, 매일 3초면 되는 작은 습관부터 추가해보세요.</p>
          <button type="button" onClick={onAdd} className="mt-4 h-12 w-full rounded-2xl bg-[#3182f6] font-black text-white">
            첫 습관 만들기
          </button>
        </Card>
      )}
    </>
  );
}

function GrassView({ dashboard, selectedHabit, selectedHabitId, grassRange, activeGrass, bestStreak, totalDone, onChangeHabit, onChangeRange }: { dashboard: HabitDashboard; selectedHabit: HabitSummary | undefined; selectedHabitId: number | "all"; grassRange: "month" | "year"; activeGrass: GrassDay[]; bestStreak: number; totalDone: number; onChangeHabit: (value: string) => void; onChangeRange: (value: "month" | "year") => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#3182f6]">Habit Reports</p>
          <h2 className="mt-1 text-xl font-black">잔디 보기</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {selectedHabit ? selectedHabit.title : "전체 습관"} · {grassRange === "month" ? "Monthly" : "Yearly"}
          </p>
        </div>
        <select value={selectedHabitId} onChange={(event) => onChangeHabit(event.target.value)} className="h-10 rounded-full bg-slate-100 px-3 text-sm font-bold outline-none">
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
            onClick={() => onChangeRange(range)}
            className={`border-b-2 pb-3 transition ${grassRange === range ? "border-[#3182f6] text-[#3182f6]" : "border-transparent text-slate-400"}`}
          >
            {range === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <GrassHeatmap days={activeGrass} range={grassRange} />

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatPill value={dashboard.todayCompletedCount} label="Met" />
        <StatPill value={totalDone} label="Total Done" />
        <StatPill value={selectedHabit?.streak ?? bestStreak} label="Best Streak" />
      </div>
    </Card>
  );
}

function PointView({ dashboard, showPointRules, onToggleRules, onOpenGrass }: { dashboard: HabitDashboard; showPointRules: boolean; onToggleRules: () => void; onOpenGrass: () => void }) {
  const progressPercent = Math.min(100, (dashboard.pointMission.progress / dashboard.pointMission.target) * 100);

  return (
    <>
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
          <div className="h-full rounded-full bg-[#3182f6] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        <p className="mt-2 text-xs font-bold text-slate-500">
          이번 주 {dashboard.pointMission.progress}/{dashboard.pointMission.target}일 체크
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onToggleRules} className="h-12 rounded-2xl bg-white font-black text-[#3182f6] shadow-sm">
            {showPointRules ? "닫기" : "규칙 보기"}
          </button>
          <button type="button" onClick={onOpenGrass} className="h-12 rounded-2xl bg-[#3182f6] font-black text-white shadow-sm">
            기록 보기
          </button>
        </div>
      </Card>

      {showPointRules ? (
        <Card>
          <h3 className="text-lg font-black">포인트 적용 원칙</h3>
          <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
            <li>• 매 체크마다 지급하지 않고 주간·월간 완주처럼 의미 있는 행동에만 연결</li>
            <li>• 실제 Toss Point 지급 전에는 예산, 중복 지급 방지, 프로모션 정책을 먼저 확인</li>
            <li>• 보상은 “돈 준다”보다 “루틴 보너스”로 낮은 기대치와 건강한 리텐션을 설계</li>
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function BenefitsView({ showDetail, onToggleDetail, onUsePreset }: { showDetail: boolean; onToggleDetail: () => void; onUsePreset: (preset: string) => void }) {
  return (
    <>
      <Card className="bg-slate-950 text-white ring-0">
        <p className="text-sm font-black text-blue-200">Unique Advantage</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">토스 안에서 바로 이어지는 습관</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">일반 습관앱과 달리, 소비 확인·저축 목표·불필요한 소비 줄이기처럼 토스 맥락의 금융 행동을 매일 3초 루틴으로 바꿉니다.</p>
        <button type="button" onClick={onToggleDetail} className="mt-5 h-12 w-full rounded-2xl bg-white font-black text-slate-950">
          {showDetail ? "핵심만 보기" : "차별점 자세히 보기"}
        </button>
      </Card>

      <div className="grid gap-3">
        <AdvantageCard icon="💰" title="금융 습관 특화" description="토스에서 이미 확인하는 소비·저축 행동을 습관화해 진입 장벽을 낮춰요." />
        <AdvantageCard icon="▦" title="잔디로 보이는 성취" description="한달·1년 기록을 시각화해서 ‘오늘도 하나만’ 하게 만드는 동기를 줘요." />
        <AdvantageCard icon="★" title="포인트 미션 확장성" description="앱인토스 프로모션이 가능해지면 주간 완주 같은 의미 있는 행동에 보상을 연결할 수 있어요." />
      </div>

      {showDetail ? (
        <Card>
          <h3 className="text-lg font-black">추천 시작 루틴</h3>
          <div className="mt-3 grid gap-2">
            {financeSuggestions.map((preset) => (
              <button key={preset} type="button" onClick={() => onUsePreset(preset)} className="rounded-2xl bg-blue-50 px-4 py-3 text-left text-sm font-black text-[#1b64da]">
                + {preset} 추가 화면으로 이동
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function AdvantageCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <Card>
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl">{icon}</div>
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </Card>
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
            className={`mt-3 flex h-11 w-11 items-center justify-center rounded-full text-lg font-black shadow-sm transition active:scale-[0.96] ${habit.isTodayCompleted ? "bg-[#3182f6] text-white" : "bg-white text-slate-300"}`}
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
              className={`mt-1 flex aspect-square items-center justify-center rounded-full text-xs font-black ${day.isCompleted ? "bg-[#3182f6] text-white" : day.isToday ? "bg-white text-[#3182f6] ring-2 ring-blue-100" : "bg-white/70 text-slate-300"}`}
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
          <div key={day.date} title={`${day.date} · ${day.count}개 완료`} className={`flex items-center justify-center rounded-lg text-[10px] font-black ${grassClass(day.level, day.isToday)} ${range === "month" ? "aspect-square" : "h-3.5 w-3.5"}`}>
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

function BottomNav({ activeTab, onSelect }: { activeTab: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <nav className="fixed bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-full bg-white/90 p-2 shadow-2xl shadow-slate-300/40 ring-1 ring-slate-100 backdrop-blur">
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.key)}
          className={`flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-lg font-black transition ${activeTab === item.key ? "bg-[#3182f6] text-white" : "text-slate-400 hover:bg-slate-100"}`}
          title={item.label}
          aria-label={item.label}
          aria-pressed={activeTab === item.key}
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
