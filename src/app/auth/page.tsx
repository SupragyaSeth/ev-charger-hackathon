"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api-client";
import type { User } from "@/types";

interface AuthResult {
  user?: User | null;
}

export default function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      let data: AuthResult;
      if (mode === "signup") {
        data = (await authApi.signUp(email, password, name)) as AuthResult;
      } else {
        data = (await authApi.signIn(email, password)) as AuthResult;
      }

      // Store user data in localStorage
      if (data?.user) {
        window.localStorage.setItem("user", JSON.stringify(data.user));
        router.push("/");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Auth failed";
      setMessage(errorMessage);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/credo.png" alt="Credo" className="h-16 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-2">
            EV Charging Station
          </h1>
          <p className="text-black">
            Please sign in to access the charging queue
          </p>
        </div>
        {!showForgot && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
            {/* Tab Buttons */}
            <div className="flex bg-gray-50 dark:bg-gray-700 rounded-lg p-1 mb-6">
              <button
                className={`flex-1 py-3 px-4 rounded-md text-sm font-medium hover:cursor-pointer transition-all duration-200 ${
                  mode === "signin"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-500"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600/50"
                }`}
                onClick={() => {
                  setMode("signin");
                  setMessage("");
                }}
              >
                Sign In
              </button>
              <button
                className={`flex-1 py-3 px-4 rounded-md text-sm hover:cursor-pointer font-medium transition-all duration-200 ${
                  mode === "signup"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-500"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-600/50"
                }`}
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="text-right">
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setForgotMsg(null);
                    }}
                    className="text-sm text-blue-600 hover:underline hover:cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white hover:cursor-pointer py-3 px-4 rounded-lg font-medium shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {mode === "signup"
                      ? "Creating Account..."
                      : "Signing In..."}
                  </div>
                ) : mode === "signup" ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Message */}
            {message && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  {message}
                </p>
              </div>
            )}
          </div>
        )}
        {showForgot && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
            <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">
              Reset Password
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Enter your account email and we will send a reset link if it
              exists.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setForgotMsg(null);
                setForgotLoading(true);
                try {
                  const res = await fetch("/api/auth/request-password-reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: forgotEmail }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.success) {
                    if (res.status === 404) {
                      setForgotMsg("Email not found in our system.");
                      return;
                    }
                    throw new Error(data.error || "Failed");
                  }
                  setForgotMsg("Reset link sent.");
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : "Failed";
                  setForgotMsg(msg);
                } finally {
                  setForgotLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 hover:cursor-pointer transition-colors duration-200"
              >
                {forgotLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
            {forgotMsg && (
              <div className="mt-4 text-sm text-center text-gray-700 dark:text-gray-300">
                {forgotMsg}
              </div>
            )}
            <div className="mt-4 text-center">
              <button
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline hover:cursor-pointer"
                onClick={() => setShowForgot(false)}
              >
                Back to {mode === "signin" ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </div>
        )}
        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-black">
            {mode === "signup"
              ? "By creating an account, you agree to our terms of service."
              : "Need help? Contact Credo IT Support"}
          </p>
        </div>
      </div>
    </div>
  );
}
