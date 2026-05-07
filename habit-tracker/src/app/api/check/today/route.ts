import { NextResponse } from "next/server";
import { getHabitSnapshot, setTodayCheck } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { isCompleted?: boolean };
    setTodayCheck(Boolean(body.isCompleted));
    return NextResponse.json(getHabitSnapshot());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "오늘 체크 실패" }, { status: 400 });
  }
}
