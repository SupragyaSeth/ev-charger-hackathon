"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { queueApi, authApi } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";
import { QueueEntry } from "@/types";
import React from "react";

//not using anymore, may use later with new features
interface Charger {
  id: number;
  name: string;
  location?: string;
  isActive: boolean;
  timeRemaining: number; // in minutes
  currentUser?: number;
}

// Time display component to prevent re-renders of parent
function CurrentTimeDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  return (
    <p className="text-lg text-gray-600 dark:text-gray-300">
      Current Time: {currentTime.toLocaleTimeString()}
    </p>
  );
}

export default function Home() {
  // Profile popup state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [queueUsers, setQueueUsers] = useState<
    Record<number, { id: number; name?: string; email?: string }>
  >({});
  const [chargers, setChargers] = useState<Charger[]>([
    {
      id: 1,
      name: "Charger A",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 2,
      name: "Charger B",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 3,
      name: "Charger C",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 4,
      name: "Charger D",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 5,
      name: "Charger E",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 6,
      name: "Charger F",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 7,
      name: "Charger G",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 8,
      name: "Charger H",
      location: "Back Parking Lot",
      isActive: false,
      timeRemaining: 0,
    },
  ]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationInput, setDurationInput] = useState(60);
  const [confirmingChargerId, setConfirmingChargerId] = useState<number | null>(
    null
  );
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completingEntry, setCompletingEntry] = useState<QueueEntry | null>(
    null
  );
  const [toastShownFor, setToastShownFor] = useState<{
    nextInLine: number | null; // Track which queue entry ID we've shown the toast for
    overtime: boolean;
    almostDone: boolean;
  }>({ nextInLine: null, overtime: false, almostDone: false });
  const [modalDismissedFor, setModalDismissedFor] = useState<{
    durationModal: boolean;
    completionModal: boolean;
  }>({ durationModal: false, completionModal: false });
  const [modalTimeoutId, setModalTimeoutId] = useState<NodeJS.Timeout | null>(
    null
  );
  const [modalCountdownInterval, setModalCountdownInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [modalTimeRemaining, setModalTimeRemaining] = useState<number>(0);
  const router = useRouter();
  const { addToast } = useToast();

  // Computed values for queue stats
  const waitingQueue = queue.filter((entry) => entry.status === "waiting");
  const chargingQueue = queue.filter((entry) => entry.status === "charging");
  const overtimeQueue = queue.filter((entry) => entry.status === "overtime");

  const CHARGING_DURATION_MINUTES = 180; // 3 hours

  const fetchQueue = useCallback(
    async function fetchQueue() {
      setQueueLoading(true);
      try {
        const data = await queueApi.getQueueStatus();
        setQueue(data.queue || []);

        // Fetch user info for all userIds in the queue
        const userIds = Array.from(
          new Set((data.queue || []).map((entry: any) => entry.userId))
        );

        if (userIds.length > 0) {
          const usersData = await queueApi.getUsers(userIds);
          const userMap: Record<
            number,
            { id: number; name?: string; email?: string }
          > = {};
          usersData.users.forEach((u: any) => {
            userMap[u.id] = u;
          });
          setQueueUsers(userMap);
        } else {
          setQueueUsers({});
        }
      } catch (error) {
        console.error("Failed to fetch queue:", error);
        addToast("Failed to fetch queue data", "error");
        setQueue([]);
        setQueueUsers({});
      }
      setQueueLoading(false);
    },
    [addToast]
  );

  useEffect(() => {
    const user = window.localStorage.getItem("user");
    if (!user) {
      router.replace("/auth");
      return;
    }
    setAuthChecked(true);
    fetchQueue();

    // Initialize timers on app load
    fetch("/api/init-timers")
      .then((response) => response.json())
      .then((data) => {
        console.log("Timer initialization:", data);
      })
      .catch((error) => {
        console.error("Failed to initialize timers:", error);
      });

    // Update queue status every 5 seconds to get real-time timer updates
    const queueInterval = setInterval(() => {
      fetchQueue();
    }, 5000);

    // Update charger times every 5 seconds (though this might not be needed with server-side timers)
    const chargerInterval = setInterval(() => {
      setChargers((prev) =>
        prev.map((charger) => ({
          ...charger,
          timeRemaining: Math.max(0, charger.timeRemaining - 1),
          isActive: charger.timeRemaining > 1,
        }))
      );
    }, 5000);

    return () => {
      clearInterval(queueInterval);
      clearInterval(chargerInterval);
      // Clear modal timeout if it exists
      if (modalTimeoutId) {
        clearTimeout(modalTimeoutId);
      }
      // Clear modal countdown interval if it exists
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
      }
    };
  }, [fetchQueue, router]);

  async function joinQueue() {
    setMessage("");
    setLoading(true);

    if (!user?.id) {
      setMessage("User not loaded");
      addToast("User not loaded", "error");
      setLoading(false);
      return;
    }

    try {
      // Get the best available charger
      const bestChargerData = await queueApi.getBestCharger();
      const bestChargerId = bestChargerData.chargerId;

      console.log(`[joinQueue] Assigning user to charger ${bestChargerId}`);

      await queueApi.joinQueue(user.id, bestChargerId);
      setMessage(`You joined the queue!`);
      addToast(`Successfully joined the queue!`, "success");
      await fetchQueue(); // This will trigger the modal if user is first
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to join queue";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
      console.error("[joinQueue] error:", error);
    }

    setLoading(false);
  }

  // Helper to get charger name by id
  function getChargerName(chargerId: number) {
    const charger = chargers.find((c) => c.id === chargerId);
    return charger ? charger.name : `Charger ${chargerId}`;
  }

  async function confirmCharging() {
    if (!confirmingChargerId || !user?.id) return;

    // Validate duration input
    if (durationInput < 30) {
      addToast("Duration must be at least 30 minutes", "error");
      return;
    }
    if (durationInput > 480) {
      addToast("Duration cannot exceed 8 hours (480 minutes)", "error");
      return;
    }

    setLoading(true);
    try {
      await queueApi.startCharging(user.id, confirmingChargerId, durationInput);
      setMessage(
        `You are now charging on ${getChargerName(confirmingChargerId)}!`
      );
      addToast(
        `Started charging on ${getChargerName(confirmingChargerId)}!`,
        "success"
      );
      setShowDurationModal(false);
      // Reset the duration modal dismissed flag since user successfully confirmed
      setModalDismissedFor((prev) => ({ ...prev, durationModal: false }));

      // Clear the modal timeout
      if (modalTimeoutId) {
        clearTimeout(modalTimeoutId);
        setModalTimeoutId(null);
      }
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
        setModalCountdownInterval(null);
      }
      setModalTimeRemaining(0);

      await fetchQueue();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start charging";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
    }
    setLoading(false);
  }

  async function handleCancelCharging() {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Remove the user from the queue completely
      await queueApi.removeFromQueue(user.id);
      setMessage("You've been removed from the queue");
      addToast(
        "You left the queue. Your spot has been given to the next person.",
        "info"
      );

      // Close the modal and reset states
      setShowDurationModal(false);
      setConfirmingChargerId(null);
      setModalDismissedFor((prev) => ({ ...prev, durationModal: false }));

      // Clear the modal timeout
      if (modalTimeoutId) {
        clearTimeout(modalTimeoutId);
        setModalTimeoutId(null);
      }
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
        setModalCountdownInterval(null);
      }
      setModalTimeRemaining(0);

      // Reset toast flags so next person can get their notifications
      setToastShownFor((prev) => ({ ...prev, nextInLine: null }));

      // Refresh the queue to update positions and trigger next person's modal
      await fetchQueue();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to leave queue";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
    }
    setLoading(false);
  }

  async function handleModalTimeout() {
    if (!user?.id) return;

    try {
      // Move user back one spot in the queue instead of removing them
      await queueApi.moveBackOneSpot(user.id);

      // Close the modal and reset states
      setShowDurationModal(false);
      setConfirmingChargerId(null);
      setModalDismissedFor((prev) => ({ ...prev, durationModal: false }));
      setModalTimeoutId(null);
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
        setModalCountdownInterval(null);
      }
      setModalTimeRemaining(0);

      // Reset toast flags so next person can get their notifications
      setToastShownFor((prev) => ({ ...prev, nextInLine: null }));

      // Show timeout message
      addToast(
        "Time expired! You've been moved back one spot to give the next person a chance.",
        "warning"
      );

      // Refresh the queue to update positions and trigger next person's modal
      await fetchQueue();
    } catch (error) {
      console.error("Failed to handle modal timeout:", error);
    }
  }

  async function handleMoveBackOneSpot() {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Move user back one spot in the queue
      await queueApi.moveBackOneSpot(user.id);
      setMessage("You've been moved back one spot in the queue");
      addToast(
        "Moved back one spot. The next person can go ahead of you!",
        "info"
      );

      // Close the modal and reset states
      setShowDurationModal(false);
      setConfirmingChargerId(null);
      setModalDismissedFor((prev) => ({ ...prev, durationModal: false }));

      // Clear the modal timeout
      if (modalTimeoutId) {
        clearTimeout(modalTimeoutId);
        setModalTimeoutId(null);
      }
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
        setModalCountdownInterval(null);
      }
      setModalTimeRemaining(0);

      // Reset toast flags so next person can get their notifications
      setToastShownFor((prev) => ({ ...prev, nextInLine: null }));

      // Refresh the queue to update positions and trigger next person's modal
      await fetchQueue();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to move back one spot";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
    }
    setLoading(false);
  }

  async function leaveQueue() {
    if (!user?.id) return;

    setLoading(true);
    try {
      await queueApi.removeFromQueue(user.id);
      setMessage("You left the queue");
      addToast("Successfully left the queue", "success");
      await fetchQueue();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to leave queue";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
    }
    setLoading(false);
  }

  async function completeCharging() {
    if (!completingEntry || !user?.id) return;

    setLoading(true);
    try {
      await queueApi.completeCharging(user.id, completingEntry.chargerId);
      setMessage("Charging completed! Thank you for using the EV charger.");
      addToast("Charging session completed successfully!", "success");
      setShowCompletionModal(false);
      setCompletingEntry(null);
      // Reset the completion modal dismissed flag since user successfully completed
      setModalDismissedFor((prev) => ({ ...prev, completionModal: false }));
      await fetchQueue();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to complete charging";
      setMessage(errorMessage);
      addToast(errorMessage, "error");
    }
    setLoading(false);
  }

  function signOut() {
    // Clear user data from localStorage
    window.localStorage.removeItem("user");

    // Show success message
    addToast("Successfully signed out", "success");

    // Redirect to auth page
    router.replace("/auth");
  }

  function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  function formatSeconds(seconds: number): string {
    if (seconds <= 0) return "0s";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Legacy functions kept for fallback compatibility
  function getEstimatedStartTime(position: number, chargerId: number): Date {
    const charger = chargers.find((c) => c.id === chargerId);
    if (!charger) return new Date();

    const waitTime =
      charger.timeRemaining + (position - 1) * CHARGING_DURATION_MINUTES;
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() + waitTime);
    return startTime;
  }

  function getWaitTime(position: number, chargerId: number): number {
    const charger = chargers.find((c) => c.id === chargerId);
    if (!charger) return 0;

    return charger.timeRemaining + (position - 1) * CHARGING_DURATION_MINUTES;
  }

  function getChargerStatusColor(charger: Charger): string {
    if (!charger.isActive) return "bg-green-500";
    if (charger.timeRemaining > 120) return "bg-red-500";
    if (charger.timeRemaining > 60) return "bg-yellow-500";
    return "bg-orange-500";
  }

  function getChargerStatusText(charger: Charger): string {
    if (!charger.isActive) return "Available";
    return `In Use - ${formatTime(charger.timeRemaining)} remaining`;
  }

  // User info state (from DB)
  const [user, setUser] = useState<{
    id?: number;
    name?: string;
    email?: string;
    photo?: string;
  } | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const userRaw =
        typeof window !== "undefined"
          ? window.localStorage.getItem("user")
          : null;
      console.log("localStorage userRaw:", userRaw);
      if (!userRaw) {
        router.replace("/auth");
        return;
      }
      let localUser: { id?: number; name?: string; email?: string } = {};
      // If userRaw is a plain string (email), migrate to object
      if (typeof userRaw === "string" && userRaw[0] !== "{") {
        // Try to fetch user info from backend by email
        try {
          const userData = await authApi.getUser(userRaw);
          if (userData.user && userData.user.id) {
            window.localStorage.setItem("user", JSON.stringify(userData.user));
            window.location.reload();
            return;
          } else {
            window.localStorage.removeItem("user");
            router.replace("/auth");
            return;
          }
        } catch (e) {
          console.error("Failed to migrate user:", e);
          window.localStorage.removeItem("user");
          router.replace("/auth");
          return;
        }
      }
      try {
        localUser = JSON.parse(userRaw);
      } catch {
        window.localStorage.removeItem("user");
        router.replace("/auth");
        return;
      }
      console.log("[DEBUG] Parsed localUser:", localUser);
      if (!localUser.id) {
        window.localStorage.removeItem("user");
        router.replace("/auth");
        return;
      }
      // Fetch user info from backend
      try {
        const userData = await authApi.getUser(localUser.id!);
        if (userData.user) {
          setUser(userData.user);
        } else {
          window.localStorage.removeItem("user");
          router.replace("/auth");
        }
      } catch (e) {
        console.log("[DEBUG] Error fetching user info:", e);
        window.localStorage.removeItem("user");
        router.replace("/auth");
      }
    }
    if (authChecked) {
      fetchUser();
    }
  }, [authChecked, router]);

  // Close profile popup on outside click (must be before any return)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClick);
    } else {
      document.removeEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  // Show modal if user is first in queue
  useEffect(() => {
    console.log("[DEBUG] Modal check - user:", user?.id, "queue:", queue);

    if (!user?.id) {
      setShowDurationModal(false);
      setConfirmingChargerId(null);
      setShowCompletionModal(false);
      setCompletingEntry(null);
      // Reset toast flags when user is not loaded
      setToastShownFor({
        nextInLine: null,
        overtime: false,
        almostDone: false,
      });
      // Reset modal dismissed flags when user is not loaded
      setModalDismissedFor({ durationModal: false, completionModal: false });
      return;
    }

    // Check if user is currently charging or overtime
    const userChargingEntry = queue.find(
      (entry) =>
        entry.userId === user.id &&
        (entry.status === "charging" || entry.status === "overtime")
    );

    if (userChargingEntry) {
      // Only show completion modal if user is overtime OR has 2 minutes or less remaining
      const shouldShowModal =
        userChargingEntry.status === "overtime" ||
        (userChargingEntry.remainingSeconds !== undefined &&
          userChargingEntry.remainingSeconds <= 120);

      if (shouldShowModal && !modalDismissedFor.completionModal) {
        setCompletingEntry(userChargingEntry);
        setShowCompletionModal(true);

        // Show toasts only once per session
        if (userChargingEntry.status === "overtime") {
          if (!toastShownFor.overtime) {
            addToast("Time expired! Please move your car.", "error", 0);
            setToastShownFor((prev) => ({ ...prev, overtime: true }));
          }
        } else if (
          userChargingEntry.remainingSeconds !== undefined &&
          userChargingEntry.remainingSeconds <= 120
        ) {
          if (!toastShownFor.almostDone) {
            addToast("Almost done! Please prepare to unplug.", "warning", 0);
            setToastShownFor((prev) => ({ ...prev, almostDone: true }));
          }
        }
      } else if (!shouldShowModal) {
        setShowCompletionModal(false);
        setCompletingEntry(null);
        // Reset modal dismissed flag when condition no longer applies
        setModalDismissedFor((prev) => ({ ...prev, completionModal: false }));
        // Reset almostDone flag when not in the final minutes anymore
        setToastShownFor((prev) => ({ ...prev, almostDone: false }));
      }
    } else {
      setShowCompletionModal(false);
      setCompletingEntry(null);
      // Reset charging-related toast flags and modal dismissed flag when not charging
      setToastShownFor((prev) => ({
        ...prev,
        overtime: false,
        almostDone: false,
      }));
      setModalDismissedFor((prev) => ({ ...prev, completionModal: false }));
    }

    // Calculate waitingQueue here to avoid dependency issues
    const currentWaitingQueue = queue.filter(
      (entry) => entry.status === "waiting"
    );
    console.log("Waiting entries:", currentWaitingQueue);

    // Check if user is first in line for any charger AND that charger is available
    const userFirstInLine = currentWaitingQueue.find(
      (entry) => entry.userId === user.id && entry.position === 1
    );

    console.log("User first in line:", userFirstInLine);

    // Only show modal if user is first in line AND the charger is actually available
    let canStartCharging = false;
    if (userFirstInLine) {
      // Check if the charger is occupied (someone is charging or in overtime)
      const isChargerOccupied = [...chargingQueue, ...overtimeQueue].some(
        (entry) => entry.chargerId === userFirstInLine.chargerId
      );
      canStartCharging = !isChargerOccupied;

      console.log(
        "[DEBUG] Charger",
        userFirstInLine.chargerId,
        "occupied:",
        isChargerOccupied,
        "can start:",
        canStartCharging
      );
    }

    if (userFirstInLine && canStartCharging) {
      // Always show modal when user is first in line and charger is available
      if (!showDurationModal) {
        setShowDurationModal(true);
        setConfirmingChargerId(userFirstInLine.chargerId);

        // Start the 20-minute countdown timer
        setModalTimeRemaining(1200); // 20 minutes in seconds
        const timeoutId = setTimeout(() => {
          handleModalTimeout();
        }, 1200000); // 20 minutes in milliseconds
        setModalTimeoutId(timeoutId);

        // Start countdown interval
        const countdownInterval = setInterval(() => {
          setModalTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setModalCountdownInterval(countdownInterval);

        // Show "charger ready" toast only once per queue entry
        if (toastShownFor.nextInLine !== userFirstInLine.id) {
          addToast(
            "Your charger is ready! Please plug in. You have 20 minutes to respond or you'll be moved back one spot.",
            "success",
            0
          );
          setToastShownFor((prev) => ({
            ...prev,
            nextInLine: userFirstInLine.id,
          }));
        }
      }
    } else if (userFirstInLine && !canStartCharging) {
      // User is first in line but charger is still occupied - just show toast
      if (toastShownFor.nextInLine !== userFirstInLine.id) {
        addToast(
          "You're next in line! Waiting for charger to become available.",
          "info",
          0
        );
        setToastShownFor((prev) => ({
          ...prev,
          nextInLine: userFirstInLine.id,
        }));
      }
      // Don't show the duration modal yet
      setShowDurationModal(false);
      setConfirmingChargerId(null);
      // Clear any existing timeout
      if (modalTimeoutId) {
        clearTimeout(modalTimeoutId);
        setModalTimeoutId(null);
      }
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
        setModalCountdownInterval(null);
      }
      setModalTimeRemaining(0);
    } else if (!userChargingEntry) {
      setShowDurationModal(false);
      setConfirmingChargerId(null);
      // Clear any existing timeout
      if (modalTimeoutId) {
        clearTimeout(modalTimeoutId);
        setModalTimeoutId(null);
      }
      if (modalCountdownInterval) {
        clearInterval(modalCountdownInterval);
        setModalCountdownInterval(null);
      }
      setModalTimeRemaining(0);
      // Reset nextInLine flag and modal dismissed flag when no longer first in line
      setToastShownFor((prev) => ({ ...prev, nextInLine: null }));
      setModalDismissedFor((prev) => ({ ...prev, durationModal: false }));
    }
  }, [queue, user, addToast]);

  // Map chargerId to charging/overtime queue entry
  const chargingMap: Record<number, QueueEntry> = {};
  [...chargingQueue, ...overtimeQueue].forEach((entry) => {
    chargingMap[entry.chargerId] = entry;
  });

  if (!authChecked || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg text-gray-700 dark:text-gray-200">
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-8 relative">
      {/* Profile Button & Popup */}
      <div className="absolute top-6 right-8 z-50" ref={profileRef}>
        <button
          className="flex items-center gap-3 bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md backdrop-blur-sm cursor-pointer"
          onClick={() => setProfileOpen((v) => !v)}
        >
          <span className="text-gray-800 dark:text-white font-medium text-sm truncate max-w-[120px]">
            {user?.name || "User"}
          </span>
          <img
            src={
              user?.photo ||
              "https://ui-avatars.com/api/?name=" +
                encodeURIComponent(user?.name || "U") +
                "&background=4F46E5&color=fff"
            }
            alt="Profile"
            className="w-8 h-8 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover"
          />
        </button>
        {profileOpen && (
          <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center z-50">
            <img
              src={
                user?.photo ||
                "https://ui-avatars.com/api/?name=" +
                  encodeURIComponent(user?.name || "U") +
                  "&background=4F46E5&color=fff"
              }
              alt="Profile Large"
              className="w-20 h-20 rounded-full border-3 border-blue-100 mb-4 object-cover"
            />
            <div className="text-lg font-semibold text-gray-800 dark:text-white mb-1">
              {user?.name || "User"}
            </div>
            <div className="text-gray-500 dark:text-gray-300 text-sm mb-6">
              {user?.email || "No email"}
            </div>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 cursor-pointer"
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors duration-200 cursor-pointer"
                onClick={signOut}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Duration Modal */}
      {showDurationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
              Plug In & Confirm
            </h2>
            {modalTimeRemaining > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
                    Time remaining: {Math.floor(modalTimeRemaining / 60)}:
                    {String(modalTimeRemaining % 60).padStart(2, "0")}
                  </span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 text-center mt-1">
                  You'll be moved back one spot if you don't respond
                </p>
              </div>
            )}
            <p className="mb-2 text-gray-600 dark:text-gray-300">
              Charger assigned:{" "}
              <span className="font-semibold">
                {getChargerName(confirmingChargerId ?? 0)}
              </span>
            </p>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              Please plug in your car and specify how long you'll use the
              charger (in minutes):
            </p>
            <div className="mb-4">
              <input
                type="text"
                value={durationInput === 0 ? "" : durationInput.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setDurationInput(0);
                  } else if (/^\d+$/.test(value)) {
                    const numValue = parseInt(value, 10);
                    if (numValue >= 1 && numValue <= 480) {
                      setDurationInput(numValue);
                    }
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setDurationInput(60);
                  }
                }}
                placeholder="Enter minutes (1-480)"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400 ">
                <span>Min: 30 minutes</span>
                <span>Max: 8 hours (480 min)</span>
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDurationInput(30)}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 hover:cursor-pointer dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  30min
                </button>
                <button
                  type="button"
                  onClick={() => setDurationInput(60)}
                  className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 hover:cursor-pointer dark:hover:bg-blue-800 transition-colors duration-200"
                >
                  1hr
                </button>
                <button
                  type="button"
                  onClick={() => setDurationInput(120)}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 hover:cursor-pointer dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  2hr
                </button>
                <button
                  type="button"
                  onClick={() => setDurationInput(180)}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 hover:cursor-pointer dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  3hr
                </button>
                <button
                  type="button"
                  onClick={() => setDurationInput(240)}
                  className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 hover:cursor-pointer dark:hover:bg-gray-600 transition-colors duration-200"
                >
                  4hr
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-600 cursor-pointer font-medium"
                onClick={handleMoveBackOneSpot}
                disabled={loading}
                title="Move back one spot in the queue - useful if you're in a meeting or can't get to your car right now"
              >
                Move Back One Spot
              </button>
              <button
                className="px-4 py-2 rounded bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600 cursor-pointer font-medium"
                onClick={handleCancelCharging}
                disabled={loading}
                title="This will remove you from the queue completely and give your spot to the next person"
              >
                Cancel & Leave Queue
              </button>
              <button
                className="px-4 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 cursor-pointer"
                onClick={confirmCharging}
                disabled={loading}
              >
                {loading ? "Confirming..." : "Confirm & Start Charging"}
              </button>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 text-center">
              In a meeting? Use "Move Back One Spot" to let the next person go
              first while staying near the front
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1 text-center">
              "Cancel & Leave Queue" will remove you completely
            </p>
          </div>
        </div>
      )}
      {/* Completion Modal */}
      {showCompletionModal && completingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 w-full max-w-md">
            <h2
              className={`text-2xl font-bold mb-4 ${
                completingEntry.status === "overtime"
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-800 dark:text-white"
              }`}
            >
              {completingEntry.status === "overtime"
                ? "Charging Time Expired!"
                : "Confirm Completion"}
            </h2>
            <p className="mb-2 text-gray-600 dark:text-gray-300">
              Charger:{" "}
              <span className="font-semibold">
                {getChargerName(completingEntry.chargerId)}
              </span>
            </p>
            {completingEntry.status === "overtime" ? (
              <div className="mb-4">
                <p className="mb-2 text-red-600 dark:text-red-400 font-semibold">
                  Your charging time has expired! Other users are waiting.
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  Please unplug your car and move it to complete your session.
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <p className="mb-2 text-gray-600 dark:text-gray-300">
                  Time remaining:{" "}
                  <span className="font-semibold text-green-600">
                    {completingEntry.remainingSeconds !== undefined
                      ? formatSeconds(
                          Math.max(0, completingEntry.remainingSeconds)
                        )
                      : "Calculating..."}
                  </span>
                </p>
                <p className="text-gray-600 dark:text-gray-300">
                  {completingEntry.remainingSeconds !== undefined &&
                  completingEntry.remainingSeconds > 120
                    ? "Are you finished charging early and ready to unplug your car?"
                    : "Have you finished charging and unplugged your car?"}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 cursor-pointer"
                onClick={() => {
                  setShowCompletionModal(false);
                  setModalDismissedFor((prev) => ({
                    ...prev,
                    completionModal: true,
                  }));
                }}
                disabled={loading}
              >
                Not Yet
              </button>
              <button
                className={`px-4 py-2 rounded text-white font-semibold cursor-pointer ${
                  completingEntry.status === "overtime"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={completeCharging}
                disabled={loading}
              >
                {loading
                  ? "Completing..."
                  : completingEntry.remainingSeconds !== undefined &&
                    completingEntry.remainingSeconds > 120
                  ? "Yes, End Session"
                  : "Yes, I'm Done"}
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-8">
            <img src="/credo.png" alt="Credo" className="h-20 w-auto" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            EV Charging Station
          </h1>
          <CurrentTimeDisplay />
        </div>

        {/* Action Buttons */}
        <div className="text-center mb-8">
          <div className="flex justify-center gap-4 flex-wrap">
            {/* Only show Join Queue if user is not in queue */}
            {user?.id && !queue.find((entry) => entry.userId === user.id) && (
              <button
                className="bg-gradient-to-r from-blue-600 to-blue-300 hover:from-blue-500 hover:to-blue-800 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer"
                onClick={joinQueue}
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Joining Queue...
                  </div>
                ) : (
                  "Join Queue"
                )}
              </button>
            )}

            {/* Only show Leave Queue if user is in queue but not charging/overtime */}
            {user?.id &&
              queue.find(
                (entry) =>
                  entry.userId === user.id && entry.status === "waiting"
              ) && (
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  onClick={leaveQueue}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Leaving Queue...
                    </div>
                  ) : (
                    "Leave Queue"
                  )}
                </button>
              )}

            {/* Show completion button if user is charging/overtime but modal is dismissed */}
            {user?.id &&
              queue.find(
                (entry) =>
                  entry.userId === user.id &&
                  (entry.status === "charging" || entry.status === "overtime")
              ) &&
              modalDismissedFor.completionModal && (
                <button
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    const userChargingEntry = queue.find(
                      (entry) =>
                        entry.userId === user.id &&
                        (entry.status === "charging" ||
                          entry.status === "overtime")
                    );
                    if (userChargingEntry) {
                      setCompletingEntry(userChargingEntry);
                      setShowCompletionModal(true);
                      setModalDismissedFor((prev) => ({
                        ...prev,
                        completionModal: false,
                      }));
                    }
                  }}
                  disabled={loading}
                >
                  Complete Charging
                </button>
              )}

            {/* Show early completion button if user is charging with more than 2 minutes left */}
            {user?.id &&
              (() => {
                const userChargingEntry = queue.find(
                  (entry) =>
                    entry.userId === user.id &&
                    entry.status === "charging" &&
                    entry.remainingSeconds !== undefined &&
                    entry.remainingSeconds > 120
                );

                if (userChargingEntry && !showCompletionModal) {
                  return (
                    <button
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        setCompletingEntry(userChargingEntry);
                        setShowCompletionModal(true);
                        setModalDismissedFor((prev) => ({
                          ...prev,
                          completionModal: false,
                        }));
                      }}
                      disabled={loading}
                    >
                      End Session Early
                    </button>
                  );
                }
                return null;
              })()}
          </div>
          {message && (
            <p className="mt-4 text-green-600 dark:text-green-400 font-medium">
              {message}
            </p>
          )}

          {/* Show charging status */}
          {user?.id &&
            (() => {
              const userChargingEntry = queue.find(
                (entry) =>
                  entry.userId === user.id &&
                  (entry.status === "charging" || entry.status === "overtime")
              );
              if (userChargingEntry) {
                return (
                  <div
                    className={`mt-4 p-4 rounded-lg border-2 ${
                      userChargingEntry.status === "overtime"
                        ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-600"
                        : "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-600"
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span
                        className={`text-lg font-semibold ${
                          userChargingEntry.status === "overtime"
                            ? "text-red-600 dark:text-red-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {userChargingEntry.status === "overtime"
                          ? "OVERTIME"
                          : "CHARGING"}
                      </span>
                      <span className="text-gray-600 dark:text-gray-300">
                        on {getChargerName(userChargingEntry.chargerId)}
                      </span>
                    </div>
                    <div className="text-center mt-2 text-sm">
                      {userChargingEntry.status === "overtime" ? (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {userChargingEntry.remainingSeconds &&
                          userChargingEntry.remainingSeconds < 0
                            ? `${formatSeconds(
                                Math.abs(userChargingEntry.remainingSeconds)
                              )} over time`
                            : "Time expired"}
                        </span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">
                          {userChargingEntry.remainingSeconds !== undefined
                            ? `${formatSeconds(
                                Math.max(0, userChargingEntry.remainingSeconds)
                              )} remaining`
                            : "Calculating time..."}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
        </div>

        {/* Charger Layout */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
            Charger Layout
          </h2>
          <div className="flex justify-center">
            <img
              src="/chargersLayout.png"
              alt="Charger Layout"
              className="max-w-full h-auto max-h-96 rounded-lg shadow-md"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Charger Status Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              Charger Status
            </h2>
            <div className="space-y-4">
              {chargers.map((charger) => {
                const chargingEntry = chargingMap[charger.id];
                return (
                  <div
                    key={charger.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <div
                          className={`w-4 h-4 rounded-full ${
                            chargingEntry
                              ? chargingEntry.status === "overtime"
                                ? "bg-orange-500"
                                : "bg-red-500"
                              : "bg-green-500"
                          } mr-3`}
                        ></div>
                        <h3 className="font-semibold text-gray-800 dark:text-white">
                          {charger.name}
                        </h3>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          chargingEntry
                            ? chargingEntry.status === "overtime"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }`}
                      >
                        {chargingEntry
                          ? chargingEntry.status === "overtime"
                            ? `OVERTIME - ${
                                chargingEntry.remainingSeconds &&
                                chargingEntry.remainingSeconds < 0
                                  ? formatSeconds(
                                      Math.abs(chargingEntry.remainingSeconds)
                                    ) + " over"
                                  : "Time expired"
                              }`
                            : `In Use - ${
                                chargingEntry.remainingSeconds !== undefined
                                  ? formatSeconds(
                                      Math.max(
                                        0,
                                        chargingEntry.remainingSeconds
                                      )
                                    )
                                  : formatTime(
                                      chargingEntry.durationMinutes || 0
                                    )
                              } left`
                          : "Available"}
                      </span>
                    </div>
                    {charger.location && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                        {charger.location}
                      </p>
                    )}
                    {chargingEntry && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          User:{" "}
                          {queueUsers[chargingEntry.userId]?.name ||
                            queueUsers[chargingEntry.userId]?.email ||
                            chargingEntry.userId}
                        </span>
                        <span
                          className={`font-medium ${
                            chargingEntry.status === "overtime"
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {chargingEntry.status === "overtime"
                            ? chargingEntry.remainingSeconds &&
                              chargingEntry.remainingSeconds < 0
                              ? formatSeconds(
                                  Math.abs(chargingEntry.remainingSeconds)
                                ) + " over"
                              : "Time expired"
                            : chargingEntry.remainingSeconds !== undefined
                            ? formatSeconds(
                                Math.max(0, chargingEntry.remainingSeconds)
                              ) + " left"
                            : formatTime(chargingEntry.durationMinutes || 0) +
                              " left"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Queue Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              Current Queue ({waitingQueue.length} waiting)
            </h2>
            {waitingQueue.length === 0 ? (
              <div className="text-center py-12">
                {/* <div className="text-6xl mb-4"></div> */}
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  No one is waiting in the queue!
                </p>
                <p className="text-gray-500 dark:text-gray-500 mt-2">
                  Chargers are available for immediate use.
                </p>
              </div>
            ) : (
              <>
                {waitingQueue.map((entry, index) => {
                  // Use server-provided estimated times instead of client-side calculations
                  const waitTime = entry.estimatedWaitSeconds 
                    ? Math.ceil(entry.estimatedWaitSeconds / 60) 
                    : getWaitTime(entry.position, entry.chargerId);
                  
                  const estimatedStart = entry.estimatedStartTime 
                    ? new Date(entry.estimatedStartTime)
                    : getEstimatedStartTime(entry.position, entry.chargerId);

                  return (
                    <div
                      key={entry.id}
                      className={`border-l-4 ${
                        index === 0
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      } rounded-r-xl p-4 transition-all hover:shadow-md`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              index === 0
                                ? "bg-green-500 text-white"
                                : "bg-blue-500 text-white"
                            } mr-3`}
                          >
                            {entry.position}
                          </span>
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-white">
                              {queueUsers[entry.userId]?.name ||
                                queueUsers[entry.userId]?.email ||
                                `User ${entry.userId}`}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Charger {entry.chargerId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-800 dark:text-white">
                            {entry.estimatedWaitSeconds 
                              ? formatSeconds(entry.estimatedWaitSeconds)
                              : formatTime(waitTime)
                            }
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            wait time
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <span className="mr-2 text-blue-500">●</span>
                          Estimated start: {estimatedStart.toLocaleTimeString()}
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <span className="mr-2 text-green-500">●</span>
                          Added:{" "}
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      {index === 0 && (
                        <div className="mt-3 px-3 py-2 bg-green-100 dark:bg-green-800 rounded-lg">
                          {(() => {
                            // Check if the charger is occupied
                            const isChargerOccupied = [
                              ...chargingQueue,
                              ...overtimeQueue,
                            ].some(
                              (occupiedEntry) =>
                                occupiedEntry.chargerId === entry.chargerId
                            );

                            if (isChargerOccupied) {
                              return (
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                  Next in line! Waiting for current user to
                                  finish charging.
                                </p>
                              );
                            } else {
                              return (
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                  Next in line! Your charger is ready - you
                                  should see a popup to confirm.
                                </p>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {chargers.filter((c) => !chargingMap[c.id]).length}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Available Chargers
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {waitingQueue.length}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              People in Queue
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {chargingQueue.length}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Currently Charging
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {overtimeQueue.length}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Overtime Users
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {waitingQueue.length > 0
                ? (() => {
                    // Use the last person's estimated wait time for the overall estimate
                    const lastEntry = waitingQueue[waitingQueue.length - 1];
                    if (lastEntry?.estimatedWaitSeconds) {
                      return formatSeconds(lastEntry.estimatedWaitSeconds);
                    }
                    // Fallback to old calculation if server data not available
                    return formatTime(getWaitTime(waitingQueue.length, 1));
                  })()
                : "0m"}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Est. Wait Time
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
