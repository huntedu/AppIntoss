import { NextResponse } from "next/server";
import { getHabitDashboard, setTodayCheck } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { habitId?: number; isCompleted?: boolean };
    const habitId = Number(body.habitId);

    if (!Number.isFinite(habitId)) {
      throw new Error("체크할 습관을 선택해주세요.");
    }

    setTodayCheck(habitId, Boolean(body.isCompleted));
    return NextResponse.json(getHabitDashboard(habitId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "오늘 체크 실패" }, { status: 400 });
  }
}
