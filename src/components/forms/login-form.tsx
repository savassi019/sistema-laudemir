"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submittingRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setServerError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setServerError(payload.error ?? "Nao foi possivel entrar.");
        return;
      }
      window.location.href = "/modulos";
    } catch {
      setServerError("Falha de comunicacao com o servidor local.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">

      {/* Email */}
      <div className="login-form-step space-y-2" style={{ animationDelay: "500ms" }}>
        <label className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35" htmlFor="email">
          E-mail
        </label>
        <div
          className={[
            "flex items-center gap-3 rounded-xl border bg-white/[0.025] px-4 py-3.5 transition-all duration-150",
            form.formState.errors.email
              ? "border-[#b46c5d]/40 shadow-[0_0_0_3px_rgba(180,108,93,0.07)]"
              : "border-white/[0.08] focus-within:border-[#d1a04f]/35 focus-within:bg-[#0b0f0e] focus-within:shadow-[0_0_0_3px_rgba(209,160,79,0.07)]",
          ].join(" ")}
        >
          <Mail className="size-4 shrink-0 text-white/25" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full bg-transparent text-base md:text-sm text-white/90 outline-none placeholder:text-white/20"
            placeholder="voce@empresa.com"
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email ? (
          <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      {/* Password */}
      <div className="login-form-step space-y-2" style={{ animationDelay: "600ms" }}>
        <label className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35" htmlFor="password">
          Senha
        </label>
        <div
          className={[
            "flex items-center gap-3 rounded-xl border bg-white/[0.025] px-4 py-3.5 transition-all duration-150",
            form.formState.errors.password
              ? "border-[#b46c5d]/40 shadow-[0_0_0_3px_rgba(180,108,93,0.07)]"
              : "border-white/[0.08] focus-within:border-[#d1a04f]/35 focus-within:bg-[#0b0f0e] focus-within:shadow-[0_0_0_3px_rgba(209,160,79,0.07)]",
          ].join(" ")}
        >
          <LockKeyhole className="size-4 shrink-0 text-white/25" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="w-full bg-transparent text-base md:text-sm text-white/90 outline-none placeholder:text-white/20"
            placeholder="••••••••"
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="text-white/25 transition hover:text-white/55"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {form.formState.errors.password && (
          <p className="text-[12px] text-[#d59a8b]">{form.formState.errors.password.message}</p>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="login-form-step rounded-xl border border-[#b46c5d]/20 bg-[#b46c5d]/[0.08] px-4 py-3 text-[13px] text-[#f0c3b9]">
          {serverError}
        </div>
      )}

      {/* Submit */}
      <div className="login-form-step pt-1" style={{ animationDelay: "820ms" }}>
        <button
          type="submit"
          disabled={loading}
          className="login-primary-button group relative w-full overflow-hidden rounded-xl bg-[#d1a04f] px-4 py-3.5 text-[13px] font-semibold text-[#0d0a05] shadow-[0_8px_28px_rgba(209,160,79,0.38)] transition-all duration-150 hover:bg-[#daa855] hover:shadow-[0_12px_36px_rgba(209,160,79,0.48)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="relative z-10 inline-flex items-center justify-center gap-2">
            {loading
              ? <LoaderCircle className="size-4 animate-spin" />
              : null}
            Entrar no painel
            {!loading
              ? <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              : null}
          </span>
        </button>
      </div>

    </form>
  );
}