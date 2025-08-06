// Supabase database types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: number;
          email: string;
          password: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          email: string;
          password: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          email?: string;
          password?: string;
          name?: string | null;
          created_at?: string;
        };
      };
      queue: {
        Row: {
          id: number;
          position: number;
          created_at: string;
          user_id: number;
          charger_id: number;
          status: string;
          duration_minutes: number | null;
          charging_started_at: string | null;
          estimated_end_time: string | null;
        };
        Insert: {
          id?: number;
          position: number;
          created_at?: string;
          user_id: number;
          charger_id: number;
          status?: string;
          duration_minutes?: number | null;
          charging_started_at?: string | null;
          estimated_end_time?: string | null;
        };
        Update: {
          id?: number;
          position?: number;
          created_at?: string;
          user_id?: number;
          charger_id?: number;
          status?: string;
          duration_minutes?: number | null;
          charging_started_at?: string | null;
          estimated_end_time?: string | null;
        };
      };
    };
  };
}

// Legacy types for compatibility with existing code
export interface User {
  id: number;
  email: string;
  password: string;
  name?: string | null;
  createdAt: string;
}

export interface QueueEntry {
  id: number;
  position: number;
  createdAt: string;
  userId: number;
  chargerId: number;
  status: "waiting" | "charging" | "overtime";
  durationMinutes?: number | null;
  chargingStartedAt?: string | null;
  estimatedEndTime?: string | null;
  // Enhanced fields for time calculations
  estimatedStartTime?: string;
  remainingSeconds?: number;
  estimatedWaitSeconds?: number;
}
