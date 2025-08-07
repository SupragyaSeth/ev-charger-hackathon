// Export types from Supabase for consistency
export type { User, QueueEntry } from "./supabase";

// Additional types for the EV charger system
export interface Charger {
  id: number;
  name: string;
  location?: string;
  isActive: boolean;
  timeRemaining: number; // in minutes
  currentUser?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
