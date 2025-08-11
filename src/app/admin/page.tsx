"use client";
import { useEffect, useState, useRef } from "react";

interface QueueEntry {
  id: number;
  userId: number;
  chargerId: number;
  status: string;
  position: number;
  durationMinutes?: number;
  estimatedEndTime?: string;
  chargingStartedAt?: string;
}

// Map charger input (letter A-H or number 1-8) to numeric ID
const parseChargerInput = (input: string): number | null => {
  const v = input.trim().toUpperCase();
  if (/^[A-H]$/.test(v)) return "ABCDEFGH".indexOf(v) + 1;
  if (/^[1-8]$/.test(v)) return parseInt(v, 10);
  return null;
};

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [addForm, setAddForm] = useState({
    chargerInput: "A", // can be letter A-H or number 1-8
    durationMinutes: 60,
    email: "",
    name: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  // Authenticate (verifies password using existing admin endpoint). After auth, SSE provides live data.
  async function authenticate() {
    if (!password) return;
    try {
      setLoading(true);
      const res = await fetch("/api/admin/manage", {
        headers: { "x-admin-password": password },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed");
      setAuthed(true);
      setQueue(json.data.queue || []); // initial snapshot
      setError(null);
    } catch (e: any) {
      setError(e.message);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  // SSE subscription (read-only) – only active when authed so queue not exposed before password.
  useEffect(() => {
    if (!authed) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (
          (data.type === "queue_update" || data.type === "initial_state") &&
          data.queue
        ) {
          setQueue(data.queue);
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Silent; browser will auto-reconnect
    };

    return () => {
      es.close();
    };
  }, [authed]);

  async function action(action: string, body: any = {}) {
    if (!password) return;
    try {
      setLoading(true);
      if (action === "addCharging" && body.chargerInput) {
        const id = parseChargerInput(body.chargerInput);
        if (!id) {
          setError("Invalid charger (use A-H or 1-8)");
          setLoading(false);
          return;
        }
        body.chargerId = id;
        delete body.chargerInput;
      }
      const res = await fetch("/api/admin/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">Admin Queue Management</h1>
      <div className="mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="border rounded px-3 py-2 w-64 pr-10 dark:bg-gray-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !loading) authenticate();
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 px-2 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.5a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.964 7.178.07.207.07.431 0 .638C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={authenticate}
          className="px-4 h-10 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={!password || loading}
        >
          {authed ? "Refresh" : "Login"}
        </button>
        {authed && (
          <button
            onClick={() => action("clearQueue")}
            className="px-4 h-10 rounded bg-red-600 text-white disabled:opacity-50"
            disabled={loading}
          >
            Clear Entire Queue
          </button>
        )}
      </div>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {!authed && <p className="mb-8">Enter admin password to manage queue.</p>}
      {authed && (
        <>
          <h2 className="text-xl font-semibold mt-6 mb-2">
            Current Queue / Charging
          </h2>
          <div className="overflow-x-auto border rounded bg-white dark:bg-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Charger</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Pos</th>
                  <th className="px-3 py-2 text-left">Duration</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr
                    key={q.id}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-3 py-2">{q.id}</td>
                    <td className="px-3 py-2">{q.userId}</td>
                    <td className="px-3 py-2">{q.chargerId}</td>
                    <td className="px-3 py-2">{q.status}</td>
                    <td className="px-3 py-2">{q.position}</td>
                    <td className="px-3 py-2">{q.durationMinutes || "-"}</td>
                    <td className="px-3 py-2">
                      {q.estimatedEndTime
                        ? new Date(q.estimatedEndTime).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td className="px-3 py-2 flex gap-2 flex-wrap">
                      {(q.status === "charging" || q.status === "overtime") && (
                        <button
                          onClick={() =>
                            action("forceComplete", { queueEntryId: q.id })
                          }
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                        >
                          End
                        </button>
                      )}
                      <button
                        onClick={() =>
                          action("removeEntry", { queueEntryId: q.id })
                        }
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      No entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="text-xl font-semibold mt-8 mb-2">
            Add Charging Session (Skip Queue)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-4xl items-end">
            <div>
              <label className="block text-sm font-medium mb-1">
                Charger (A-H or 1-8)
              </label>
              <input
                type="text"
                maxLength={2}
                value={addForm.chargerInput}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    chargerInput: e.target.value
                      .toUpperCase()
                      .replace(/[^A-H1-8]/g, ""),
                  }))
                }
                className="border rounded px-3 py-2 w-full dark:bg-gray-800"
                placeholder="A or 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Duration (min)
              </label>
              <input
                type="text"
                value={
                  addForm.durationMinutes === 0 ? "" : addForm.durationMinutes
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setAddForm((f) => ({ ...f, durationMinutes: 0 }));
                  } else if (/^\d+$/.test(v)) {
                    const num = parseInt(v, 10);
                    if (num >= 1 && num <= 480) {
                      setAddForm((f) => ({ ...f, durationMinutes: num }));
                    }
                  }
                }}
                onBlur={() => {
                  if (!addForm.durationMinutes) {
                    setAddForm((f) => ({ ...f, durationMinutes: 60 }));
                  }
                }}
                className="border rounded px-3 py-2 w-full dark:bg-gray-800"
                placeholder="60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, email: e.target.value }))
                }
                className="border rounded px-3 py-2 w-full dark:bg-gray-800"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Name (optional)
              </label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, name: e.target.value }))
                }
                className="border rounded px-3 py-2 w-full dark:bg-gray-800"
                placeholder="Display name"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => action("addCharging", addForm)}
                className="px-4 py-2 mt-6 rounded bg-blue-600 text-white w-full disabled:opacity-50"
                disabled={loading}
              >
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
