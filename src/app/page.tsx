"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface QueueEntry {
  id: number;
  userId: number;
  chargerId: number;
  position: number;
  createdAt: string;
}

interface Charger {
  id: number;
  name: string;
  location?: string;
  isActive: boolean;
  timeRemaining: number; // in minutes
  currentUser?: number;
}

export default function Home() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([
    {
      id: 1,
      name: "Charger A",
      location: "Parking Lot A",
      isActive: true,
      timeRemaining: 45,
      currentUser: 101,
    },
    {
      id: 2,
      name: "Charger B",
      location: "Parking Lot B",
      isActive: false,
      timeRemaining: 0,
    },
    {
      id: 3,
      name: "Charger C",
      location: "Parking Lot C",
      isActive: true,
      timeRemaining: 120,
      currentUser: 102,
    },
  ]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const router = useRouter();

  const CHARGING_DURATION_MINUTES = 180; // 3 hours

  useEffect(() => {
    const user = window.localStorage.getItem("user");
    if (!user) {
      router.replace("/auth");
    } else {
      fetchQueue();
    }

    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Update charger times every minute
    const chargerInterval = setInterval(() => {
      setChargers((prev) =>
        prev.map((charger) => ({
          ...charger,
          timeRemaining: Math.max(0, charger.timeRemaining - 1),
          isActive: charger.timeRemaining > 1,
        }))
      );
    }, 60000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(chargerInterval);
    };
  }, []);

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/queue");
      const data = await res.json();
      setQueue(data.queue || []);
    } catch {
      setQueue([]);
    }
    setLoading(false);
  }

  async function joinQueue() {
    setMessage("");
    setLoading(true);
    const res = await fetch("/api/auth/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: 1, chargerId: 1 }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("You joined the queue!");
      fetchQueue();
    } else {
      setMessage(data.error || "Failed to join queue");
    }
    setLoading(false);
  }

  function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-8">
      <main className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-white mb-4">
            EV Charging Station
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Current Time: {currentTime.toLocaleTimeString()}
          </p>
        </div>

        {/* Action Button */}
        <div className="text-center mb-8">
          <button
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            onClick={joinQueue}
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Joining...
              </div>
            ) : (
              "Join Queue"
            )}
          </button>
          {message && (
            <p className="mt-4 text-green-600 dark:text-green-400 font-medium">
              {message}
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Charger Status Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
              Charger Status
            </h2>
            <div className="space-y-4">
              {chargers.map((charger) => (
                <div
                  key={charger.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div
                        className={`w-4 h-4 rounded-full ${getChargerStatusColor(
                          charger
                        )} mr-3`}
                      ></div>
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {charger.name}
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        charger.isActive
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      }`}
                    >
                      {getChargerStatusText(charger)}
                    </span>
                  </div>
                  {charger.location && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                      📍 {charger.location}
                    </p>
                  )}
                  {charger.isActive && charger.currentUser && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        User: {charger.currentUser}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {formatTime(charger.timeRemaining)} left
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Queue Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
              Current Queue ({queue.length} waiting)
            </h2>

            {queue.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-xl text-gray-600 dark:text-gray-400">
                  No one is waiting in the queue!
                </p>
                <p className="text-gray-500 dark:text-gray-500 mt-2">
                  All chargers are available for immediate use.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {queue.map((entry, index) => {
                  const waitTime = getWaitTime(entry.position, entry.chargerId);
                  const estimatedStart = getEstimatedStartTime(
                    entry.position,
                    entry.chargerId
                  );

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
                              User {entry.userId}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Charger {entry.chargerId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-800 dark:text-white">
                            {formatTime(waitTime)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            wait time
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <span className="mr-2">🕐</span>
                          Estimated start: {estimatedStart.toLocaleTimeString()}
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-400">
                          <span className="mr-2">⏱️</span>
                          Added:{" "}
                          {new Date(entry.createdAt).toLocaleTimeString()}
                        </div>
                      </div>

                      {index === 0 && (
                        <div className="mt-3 px-3 py-2 bg-green-100 dark:bg-green-800 rounded-lg">
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            🎯 Next in line! You'll be notified when your
                            charger is available.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {chargers.filter((c) => !c.isActive).length}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Available Chargers
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {queue.length}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              People in Queue
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
              {queue.length > 0
                ? formatTime(getWaitTime(queue.length, 1))
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
