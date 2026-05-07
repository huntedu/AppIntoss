import { NextResponse } from "next/server";
import { archiveHabit, createHabit, getHabitDashboard, updateHabit } from "@/lib/db";

export const runtime = "nodejs";

function selectedHabitId(request: Request) {
  const { searchParams } = new URL(request.url);
  const habitId = searchParams.get("habitId");

  if (!habitId || habitId === "all") {
    return "all" as const;
  }

  const parsed = Number(habitId);
  return Number.isFinite(parsed) ? parsed : ("all" as const);
}

export async function GET(request: Request) {
  return NextResponse.json(getHabitDashboard(selectedHabitId(request)));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string };
    createHabit(body.title ?? "");
    return NextResponse.json(getHabitDashboard(), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "습관 생성 실패" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; title?: string };
    updateHabit(Number(body.id), body.title ?? "");
    return NextResponse.json(getHabitDashboard(Number(body.id)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "습관 수정 실패" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: number };
    archiveHabit(Number(body.id));
    return NextResponse.json(getHabitDashboard());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "습관 중단 실패" }, { status: 400 });
  }
}
