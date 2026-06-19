"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function createUserRecord(userData: {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  try {
    await db.insert(users).values({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.avatarUrl,
    });
  } catch (error) {
    console.error("Failed to create user record:", error);
    throw error;
  }
}
