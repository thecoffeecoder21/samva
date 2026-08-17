import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { searchConversations, searchMessages, searchUsers } from "@/lib/search";

export async function GET(request: Request) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < 1) {
    return NextResponse.json({ users: [], conversations: [], messages: [] });
  }

  const [users, conversations, messages] = await Promise.all([
    searchUsers(user.id, query),
    searchConversations(user.id, query),
    searchMessages(user.id, query),
  ]);

  return NextResponse.json({ users, conversations, messages });
}
