"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import {
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  QrCode,
  Check,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"magic" | "password">("magic");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();
  const isConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (authMode === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            const { error: signUpError } = await supabase.auth.signUp({
              email,
              password,
            });
            if (signUpError) throw signUpError;
            window.location.href = "/dashboard";
            return;
          }
          throw error;
        }
        window.location.href = "/dashboard";
        return;
      }

      // Magic link
      const redirectUrl = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to sign in. Please verify your Supabase configuration."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-zinc-950 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Logo & Name */}
        <div className="flex justify-center items-center gap-2.5 mb-3">
          <BrandLogo size={36} />
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            ProposalFlow
          </h1>
        </div>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
          Shareable proposals that clients approve in 1 tap, automatically generating UPI QR invoices.
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 sm:px-9 shadow-sm border border-zinc-200/80 rounded-2xl">
          {isSuccess ? (
            <div className="text-center py-5">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 mb-1">Check your email</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-5">
                We sent a secure login link to <span className="font-semibold text-zinc-900">{email}</span>. Click the link to open your dashboard.
              </p>
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="text-xs font-semibold text-zinc-900 hover:underline"
              >
                ← Use another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {/* Mode Switcher */}
              <div className="flex p-1 bg-zinc-100 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAuthMode("magic")}
                  className={`flex-1 py-1 rounded-md transition text-center ${
                    authMode === "magic"
                      ? "bg-white text-zinc-950 font-semibold shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("password")}
                  className={`flex-1 py-1 rounded-md transition text-center ${
                    authMode === "password"
                      ? "bg-white text-zinc-950 font-semibold shadow-xs"
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  Password
                </button>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="block w-full pl-9 pr-3 py-2 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition placeholder:text-zinc-400"
                  />
                </div>
              </div>

              {authMode === "password" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="pass"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                    >
                      Password
                    </label>
                    <span className="text-[10px] text-zinc-400">Creates account if new</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      id="pass"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-zinc-50/50 border border-zinc-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 outline-none transition placeholder:text-zinc-400"
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 transition"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{authMode === "magic" ? "Send Magic Link" : "Sign In / Sign Up"}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 mt-5">
          Direct UPI payments. No payment gateway fees.
        </p>
      </div>
    </div>
  );
}
