import { supabaseAdmin } from "./supabase";
import { QueueEntry, User } from "@/types";

// JSON value typing
export type Primitive = string | number | boolean | null;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonValue = Primitive | JsonObject | JsonValue[];

// Helper function to convert snake_case to camelCase for compatibility
function convertToCamelCase<T extends JsonValue>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => convertToCamelCase(item)) as T;
  }
  const converted: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(obj as JsonObject)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    converted[camelKey] = convertToCamelCase(value);
  }
  return converted as T;
}

// Helper function to convert camelCase to snake_case for database operations
function convertToSnakeCase<T extends JsonValue>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => convertToSnakeCase(item)) as T;
  }
  const converted: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(obj as JsonObject)) {
    const snakeKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`
    );
    converted[snakeKey] = convertToSnakeCase(value);
  }
  return converted as T;
}

export class SupabaseService {
  // User operations
  static async findUserById(id: number): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return convertToCamelCase(data) as User;
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !data) return null;
    return convertToCamelCase(data) as User;
  }

  static async createUser(userData: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .insert(convertToSnakeCase(userData))
      .select()
      .single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);
    return convertToCamelCase(data) as User;
  }

  static async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, created_at, password")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch users: ${error.message}`);
    if (!data) return [];
    return (data as unknown[]).map((row) => {
      const r = row as {
        id: number;
        name: string | null;
        email: string;
        created_at: string;
        password: string | null;
      };
      return {
        id: r.id,
        name: r.name || undefined,
        email: r.email,
        password: r.password || "",
        createdAt: r.created_at,
      } as User;
    });
  }

  // Queue operations
  static async createQueueEntry(entryData: {
    userId: number;
    chargerId: number;
    position: number;
    status?: string;
    durationMinutes?: number;
  }): Promise<QueueEntry> {
    const { data, error } = await supabaseAdmin
      .from("queue")
      .insert(convertToSnakeCase(entryData))
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create queue entry: ${error.message}`);
    return convertToCamelCase(data) as QueueEntry;
  }

  static async findQueueEntry(filters: {
    userId?: number;
    chargerId?: number;
    status?: string | string[];
    id?: number;
  }): Promise<QueueEntry | null> {
    let query = supabaseAdmin.from("queue").select("*");

    if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.chargerId) query = query.eq("charger_id", filters.chargerId);
    if (filters.id) query = query.eq("id", filters.id);
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    const { data, error } = await query.single();

    if (error || !data) return null;
    return convertToCamelCase(data) as QueueEntry;
  }

  static async findQueueEntries(
    filters: {
      userId?: number;
      chargerId?: number;
      status?: string | string[];
    } = {}
  ): Promise<QueueEntry[]> {
    let query = supabaseAdmin.from("queue").select("*");

    if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.chargerId) query = query.eq("charger_id", filters.chargerId);
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    const { data, error } = await query.order("charger_id").order("position");

    if (error)
      throw new Error(`Failed to fetch queue entries: ${error.message}`);
    return convertToCamelCase(data) as QueueEntry[];
  }

  static async getQueueForCharger(chargerId: number): Promise<QueueEntry[]> {
    return this.findQueueEntries({ chargerId });
  }

  static async getFirstWaitingInQueue(
    chargerId: number
  ): Promise<QueueEntry | null> {
    const { data, error } = await supabaseAdmin
      .from("queue")
      .select("*")
      .eq("charger_id", chargerId)
      .eq("status", "waiting")
      .order("position")
      .limit(1)
      .single();

    if (error || !data) return null;
    return convertToCamelCase(data) as QueueEntry;
  }

  static async getLastPositionInQueue(chargerId: number): Promise<number> {
    const { data } = await supabaseAdmin
      .from("queue")
      .select("position")
      .eq("charger_id", chargerId)
      .eq("status", "waiting")
      .order("position", { ascending: false })
      .limit(1)
      .single();

    return data?.position || 0;
  }

  static async updateQueueEntry(
    id: number,
    updates: Partial<QueueEntry>
  ): Promise<QueueEntry> {
    const { data, error } = await supabaseAdmin
      .from("queue")
      .update(convertToSnakeCase(updates))
      .eq("id", id)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update queue entry: ${error.message}`);
    return convertToCamelCase(data) as QueueEntry;
  }

  static async deleteQueueEntry(id: number): Promise<void> {
    const { error } = await supabaseAdmin.from("queue").delete().eq("id", id);

    if (error)
      throw new Error(`Failed to delete queue entry: ${error.message}`);
  }

  static async deleteQueueEntries(filters: {
    userId?: number;
    status?: string | string[];
    chargerId?: number;
  }): Promise<void> {
    let query = supabaseAdmin.from("queue").delete();

    if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.chargerId) query = query.eq("charger_id", filters.chargerId);
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    const { error } = await query;

    if (error)
      throw new Error(`Failed to delete queue entries: ${error.message}`);
  }

  static async countQueueEntries(
    filters: {
      chargerId?: number;
      status?: string | string[];
    } = {}
  ): Promise<number> {
    let query = supabaseAdmin
      .from("queue")
      .select("*", { count: "exact", head: true });

    if (filters.chargerId) query = query.eq("charger_id", filters.chargerId);
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    const { count, error } = await query;

    if (error)
      throw new Error(`Failed to count queue entries: ${error.message}`);
    return count || 0;
  }

  // Clear all queue entries
  static async clearAllQueue(): Promise<void> {
    const { error } = await supabaseAdmin.from("queue").delete().neq("id", 0); // Delete all rows

    if (error) throw new Error(`Failed to clear queue: ${error.message}`);
  }

  // Password reset token operations
  static async storePasswordResetToken(
    userId: number,
    tokenHash: string,
    expiresAtIso: string
  ): Promise<void> {
    // Delete existing tokens for user (optional cleanup)
    await supabaseAdmin.from("password_reset_tokens").delete().eq("user_id", userId);
    const { error } = await supabaseAdmin.from("password_reset_tokens").insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAtIso,
    });
    if (error) throw new Error(`Failed to store reset token: ${error.message}`);
  }

  static async findValidPasswordResetToken(
    rawToken: string
  ): Promise<{ id: number; userId: number } | null> {
    // We can't query by raw token; need to fetch recent tokens and compare
    const { data, error } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id, user_id, token_hash, expires_at, used_at")
      .gte("expires_at", new Date().toISOString());
    if (error || !data) return null;
    const bcrypt = await import("bcryptjs");
    for (const row of data) {
      if (row.used_at) continue;
      const match = await bcrypt.compare(rawToken, row.token_hash);
      if (match) {
        return { id: row.id, userId: row.user_id };
      }
    }
    return null;
  }

  static async markPasswordResetTokenUsed(id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`Failed to mark token used: ${error.message}`);
  }

  static async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", userId);
    if (error) throw new Error(`Failed to update password: ${error.message}`);
  }
}
