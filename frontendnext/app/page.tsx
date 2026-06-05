"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

function getWorkspaceHome(role?: string) {
  return role === "employee" ? "/workspace/employee/my-test-plans" : "/workspace/admin/dashboard";
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("tcm_token") || ""
        : "";
    if (!token) return;
    void (async () => {
      try {
        const resp = await apiRequest<{ user: { role?: string } }>(
          "/api/auth/me",
          token,
        );
        router.replace(getWorkspaceHome(resp.user?.role));
      } catch {
        window.localStorage.removeItem("tcm_token");
      }
    })();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { name, email, password };
      const resp = await apiRequest<{
        token: string;
        user: Record<string, unknown>;
      }>(endpoint, undefined, { method: "POST", body: JSON.stringify(body) });
      if (resp?.token) {
        window.localStorage.setItem("tcm_token", resp.token);
        router.replace(
          getWorkspaceHome(
            (resp.user as { role?: string } | undefined)?.role,
          ),
        );
      } else {
        setMessage("Không nhận được token");
      }
    } catch (err: unknown) {
      let msg = "Đăng nhập thất bại";
      if (
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message: unknown }).message === "string"
      ) {
        msg = (err as { message: string }).message;
      }
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Left branding (hidden on small screens) ──────────────── */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-slate-950 px-12 lg:flex">
        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-600/30">
            TCM
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Test Case Management
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-400">
            Workspace QA theo role — quản lý test case, automation và
            execution trong một hệ thống duy nhất.
          </p>

          {/* Feature list */}
          <ul className="mt-8 space-y-3">
            {[
              "Quản lý test case & automation steps",
              "Dry run test case không cần tạo run",
              "Theo dõi kết quả theo dự án & version",
              "Phân quyền Admin / Employee rõ ràng",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm text-slate-400">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-400 text-xs">
                  ✓
                </span>
                {feat}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right form ────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              TCM
            </div>
            <span className="text-lg font-bold text-slate-900">
              Test Case Management
            </span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {mode === "login"
              ? "Nhập email và mật khẩu để tiếp tục."
              : "Tạo tài khoản mới để bắt đầu."}
          </p>

          {/* Error */}
          {message && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856C18.48 19 19 18.522 19 17.928V6.072C19 5.478 18.48 5 17.918 5H6.082C5.52 5 5 5.478 5 6.072v11.856C5 18.522 5.52 19 6.082 19z" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Họ tên
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {mode === "login" ? "Đăng nhập" : "Đăng ký"}
            </button>
          </form>

          {/* Switch mode */}
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "login" ? "register" : "login"));
                setMessage("");
              }}
              className="font-semibold text-blue-600 hover:text-blue-700"
            >
              {mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}
            </button>
          </p>
        </div>
      </div>

    </div>
  );
}
