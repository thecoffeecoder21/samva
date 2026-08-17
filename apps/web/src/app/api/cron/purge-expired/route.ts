import { NextResponse } from "next/server";
import { purgeExpiredMessages } from "@/lib/messages";

// Invoked by Vercel Cron (see vercel.json). Vercel automatically attaches
// `Authorization: Bearer <CRON_SECRET>` to its own invocations once
// CRON_SECRET is set as a project env var — reject anything else so this
// route can't be used to force a purge from outside.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const purged = await purgeExpiredMessages();
  return NextResponse.json({ ok: true, purged });
}
