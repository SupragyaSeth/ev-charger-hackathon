// Types for the EV charger system
export interface User {
  id: number;
  email: string;
  name?: string;
  createdAt: Date;
}

export interface QueueEntry {
  id: number;
  userId: number;
  chargerId: number;
  position: number;
  status: "waiting" | "charging" | "overtime" | "completed";
  createdAt: Date;
  durationMinutes?: number;
  chargingStartedAt?: Date;
  estimatedEndTime?: Date;
  remainingMinutes?: number; // Calculated field for remaining time
}

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
