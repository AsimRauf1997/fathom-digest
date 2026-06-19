import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { teamMembers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface ClerkUserEventData {
  id: string;
  email_addresses?: { id: string; email_address: string }[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}

interface ClerkEvent {
  type: string;
  data: ClerkUserEventData;
}

/**
 * Syncs Clerk's user lifecycle into our local `users` table, since Clerk
 * doesn't expose a queryable Postgres table of its own. user.deleted cascades
 * the user's team_members row(s) unconditionally — the deletion already
 * happened on Clerk's side by the time this fires, so there's no actor to
 * surface a "can't remove the last admin" error to (unlike removeMember,
 * which still enforces that invariant for in-app removals).
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const data = event.data;

  switch (event.type) {
    case "user.created":
    case "user.updated": {
      const primaryEmail =
        data.email_addresses?.find(
          (e) => e.id === data.primary_email_address_id,
        )?.email_address ?? data.email_addresses?.[0]?.email_address;
      if (!primaryEmail) break;

      const name =
        [data.first_name, data.last_name].filter(Boolean).join(" ") || null;

      await db
        .insert(users)
        .values({
          id: data.id,
          email: primaryEmail,
          name,
          avatarUrl: data.image_url ?? null,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: primaryEmail,
            name,
            avatarUrl: data.image_url ?? null,
            updatedAt: new Date(),
          },
        });
      break;
    }
    case "user.deleted": {
      await db.delete(teamMembers).where(eq(teamMembers.userId, data.id));
      await db.delete(users).where(eq(users.id, data.id));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
