"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return Boolean(window.localStorage.getItem("tcm_token"));
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    // If token exists and is valid, go to app
    const token = typeof window !== "undefined" ? window.localStorage.getItem("tcm_token") || "" : "";
    if (!token) {
      return;
    }

    (async () => {
      try {
        await apiRequest("/api/auth/me", token, { method: "GET" });
        router.push("/Home");
      } catch {
        window.localStorage.removeItem("tcm_token");
        setChecking(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const resp = await apiRequest<{ token: string; user: Record<string, unknown> }>(endpoint, undefined, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (resp?.token) {
        window.localStorage.setItem("tcm_token", resp.token);
        router.push("/Home");
      } else {
        setMessage("No token received");
      }
    } catch (err: unknown) {
      let msg = "Auth failed";
      if (typeof err === "object" && err !== null && "message" in err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msg = (err as any).message || msg;
      }
      setMessage(msg);
    }
  }

  if (checking) return null;

  return (
    <main className="shell auth-shell">
      <div className="hero">
        <h1>Test Case Management</h1>
        <p>Workspace QA theo role cho admin va employee.</p>
      </div>
      <section className="panel auth-panel">
        <h2>{mode === "login" ? "Dang nhap" : "Dang ky"}</h2>
        {message && <div className="workspace-banner">{message}</div>}
        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="field" style={{ marginBottom: "0.5rem" }}>
              <span>Ho ten</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}

          <div className="field" style={{ marginBottom: "0.5rem" }}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="field" style={{ marginBottom: "0.5rem" }}>
            <span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary">
              {mode === "login" ? "Dang nhap" : "Dang ky"}
            </button>
            <button type="button" className="btn btn-alt" onClick={() => setMode((m) => (m === "login" ? "register" : "login"))}>
              Chuyen sang {mode === "login" ? "Dang ky" : "Dang nhap"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
