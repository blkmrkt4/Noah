export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUnreadNotifications, markRead } from "@/lib/notifications";

/** GET /api/notifications?userId=xxx — Get unread notifications */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const notifications = await getUnreadNotifications(userId);
  return NextResponse.json(notifications);
}

/** PATCH /api/notifications — Mark as read */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  await markRead(ids);
  return NextResponse.json({ marked: ids.length });
}
