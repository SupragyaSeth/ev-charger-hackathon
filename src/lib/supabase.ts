import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client for frontend/client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations with elevated permissions
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database schemas
export interface User {
  id: number;
  email: string;
  password: string;
  name?: string;
  created_at: string;
}

export interface QueueEntry {
  id: number;
  position: number;
  created_at: string;
  user_id: number;
  charger_id: number;
  status: "waiting" | "charging" | "overtime";
  duration_minutes?: number;
  charging_started_at?: string;
  estimated_end_time?: string;
}

// Type definitions for compatibility
export type { User as AuthUser };
