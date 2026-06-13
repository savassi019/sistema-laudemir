"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Shield,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { defaultDemoAccount, demoAccounts } from "@/data/demo";

const schema = z.object({
  email: z.string().email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: defaultDemoAccount.email,
      password: defaultDemoAccount.password,
    },
  });

  const selectedEmail = useWatch({
    control: form.control,
    name: "email",
  });

  const selectedAccount =
    demoAccounts.find((account) => account.email === selectedEmail) ?? defaultDemoAccount;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setServerError(payload.error ?? "Nao foi possivel entrar.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setServerError("Falha de comunicacao com o servidor local.");
    } finally {
      setLoading(false);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {demoAccounts.map((account) => {
          const isActive = selectedAccount.email === account.email;

          return (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                form.setValue("email", account.email, { shouldDirty: true });
                form.setValue("password", account.password, { shouldDirty: true });
                setServerError(null);
              }}
              className={`group relative overflow-hidden rounded-[26px] border p-4 text-left transition ${
                isActive
                  ? "border-sky-400/30 bg-[linear-gradient(180deg,rgba(14,165,233,0.16),rgba(15,23,42,0.82))] shadow-[0_20px_60px_rgba(14,165,233,0.12)]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-slate-200">
                  {account.label === "Dono" ? (
                    <Shield className="size-4" />
                  ) : (
                    <UserRound className="size-4" />
                  )}
                </div>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    isActive
                      ? "border-sky-300/30 bg-sky-300/10 text-sky-100"
                      : "border-white/10 bg-white/[0.04] text-slate-400"
                  }`}
                >
                  {isActive ? "Selecionado" : "Preencher"}
                </span>
              </div>

              <h2 className="mt-5 text-lg font-semibold text-white">{account.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{account.helper}</p>

              <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                <Check className={`size-3.5 ${isActive ? "text-sky-300" : "text-slate-500"}`} />
                {account.email}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Perfil ativo
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {selectedAccount.label}
            </p>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
            Demo local
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          {selectedAccount.helper}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="email">
          E-mail
        </label>
        <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/80 px-4 py-3.5 focus-within:border-sky-400/30 focus-within:bg-slate-950">
          <Mail className="size-4 text-slate-500" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="voce@empresa.com"
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email ? (
          <p className="text-sm text-rose-300">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="password">
          Senha
        </label>
        <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-slate-950/80 px-4 py-3.5 focus-within:border-sky-400/30 focus-within:bg-slate-950">
          <LockKeyhole className="size-4 text-slate-500" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="Sua senha"
            {...form.register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="text-slate-500 hover:text-slate-300"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p className="text-sm text-rose-300">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {serverError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-[linear-gradient(135deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-4 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(148,163,184,0.18)] transition hover:scale-[0.99] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Entrar no painel
      </button>
    </form>
  );
}
