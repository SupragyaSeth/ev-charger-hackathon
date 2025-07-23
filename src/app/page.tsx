"use client";
import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [queue, setQueue] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = window.localStorage.getItem("user");
    if (!user) {
      router.replace("/auth");
    } else {
      fetchQueue();
    }
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
    // For demo, use userId=1 and chargerId=1
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

  return (
    <div className="font-sans min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-8 items-center">
        <h1 className="text-3xl font-bold mb-4">
          Welcome to EV Charger Manager
        </h1>
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded mb-4"
          onClick={joinQueue}
          disabled={loading}
        >
          {loading ? "Joining..." : "Join Queue"}
        </button>
        {message && <p className="text-green-600 mb-4">{message}</p>}
        <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Current Queue</h2>
          {queue.length === 0 ? (
            <p>No one is in the queue yet.</p>
          ) : (
            <ul className="list-decimal pl-5">
              {queue.map((entry: any) => (
                <li
                  key={entry.id}
                >{`User ${entry.userId} for Charger ${entry.chargerId} (Position: ${entry.position})`}</li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
// ...existing code...
