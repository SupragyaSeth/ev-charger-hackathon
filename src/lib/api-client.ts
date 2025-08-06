import { ApiResponse, QueueEntry } from "@/types";

/**
 * Enhanced fetch wrapper with error handling and typed responses
 */
export async function apiCall<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data.data as T;
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Queue-specific API calls
 */
export const queueApi = {
  /**
   * Fetch current queue
   */
  getQueue: async () => {
    return apiCall<{ queue: QueueEntry[] }>("/api/auth/queue");
  },

  /**
   * Add user to queue
   */
  joinQueue: async (userId: number, chargerId: number) => {
    return apiCall("/api/auth/queue", {
      method: "POST",
      body: JSON.stringify({ userId, chargerId }),
    });
  },

  /**
   * Start charging
   */
  startCharging: async (
    userId: number,
    chargerId: number,
    durationMinutes: number
  ) => {
    return apiCall("/api/auth/queue", {
      method: "PATCH",
      body: JSON.stringify({ userId, chargerId, durationMinutes }),
    });
  },

  /**
   * Remove from queue
   */
  removeFromQueue: async (userId: number) => {
    return apiCall("/api/auth/queue", {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    });
  },

  /**
   * Move user back one spot in queue
   */
  moveBackOneSpot: async (userId: number) => {
    return apiCall("/api/auth/queue", {
      method: "PUT",
      body: JSON.stringify({ userId, action: "moveBackOneSpot" }),
    });
  },

  /**
   * Get users information
   */
  getUsers: async (userIds: number[]) => {
    return apiCall<{ users: any[] }>("/api/auth/queue-users", {
      method: "POST",
      body: JSON.stringify({ userIds }),
    });
  },

  /**
   * Get queue status with timing information
   */
  getQueueStatus: async () => {
    return apiCall<{ queue: QueueEntry[] }>("/api/auth/queue-status");
  },

  /**
   * Get the best available charger for a new user
   */
  getBestCharger: async () => {
    return apiCall<{ chargerId: number }>(
      "/api/auth/queue?action=best-charger"
    );
  },

  /**
   * Complete charging session
   */
  completeCharging: async (userId: number, chargerId: number) => {
    return apiCall("/api/auth/complete-charging", {
      method: "POST",
      body: JSON.stringify({ userId, chargerId }),
    });
  },
};

/**
 * Auth-specific API calls
 */
export const authApi = {
  /**
   * Sign in user
   */
  signIn: async (email: string, password: string) => {
    return apiCall("/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  /**
   * Sign up user
   */
  signUp: async (email: string, password: string, name?: string) => {
    return apiCall("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },

  /**
   * Get user info
   */
  getUser: async (idOrEmail: string | number) => {
    const param =
      typeof idOrEmail === "number"
        ? `id=${idOrEmail}`
        : `email=${encodeURIComponent(idOrEmail)}`;
    return apiCall(`/api/auth/user?${param}`);
  },
};

/**
 * Email-specific API calls
 */
export const emailApi = {
  /**
   * Send test email
   */
  sendTestEmail: async (
    type: "charger-ready" | "almost-complete" | "expired" | "complete",
    userEmail: string,
    userName?: string
  ) => {
    return apiCall("/api/email/test", {
      method: "POST",
      body: JSON.stringify({ type, userEmail, userName }),
    });
  },

  /**
   * Get email configuration status
   */
  getEmailConfig: async () => {
    return apiCall("/api/email/test");
  },
};
