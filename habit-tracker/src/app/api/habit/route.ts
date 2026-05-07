import { NextResponse } from "next/server";
import { archiveHabit, createHabit, getHabitSnapshot, updateHabit } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getHabitSnapshot());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { title?: string };
    createHabit(body.title ?? "");
    return NextResponse.json(getHabitSnapshot(), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "습관 생성 실패" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { title?: string };
    updateHabit(body.title ?? "");
    return NextResponse.json(getHabitSnapshot());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "습관 수정 실패" }, { status: 400 });
  }
}

export async function DELETE() {
  archiveHabit();
  return NextResponse.json(getHabitSnapshot());
}
