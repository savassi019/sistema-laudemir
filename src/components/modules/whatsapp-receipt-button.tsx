"use client";

import { FileDown, ImageIcon, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  defaultPhone?: string;
  message: string;
  title?: string;
  phoneLabel?: string;
  autoOpen?: boolean;
  documentLabel?: string;
  pdfButtonLabel?: string;
};

/* ──────────────────────────────────────────────────────────────
   Canvas receipt generator — no external dependencies
   ────────────────────────────────────────────────────────────── */
async function generateReceiptImage(message: string, documentLabel: string): Promise<Blob> {
  const W     = 640;
  const SCALE = 2;          // retina
  const PAD   = 44;
  const LINE  = 44;

  const rawLines = message.split("\n").filter((l) => l.trim());

  type Parsed = { text: string; isBold: boolean; key?: string; val?: string };
  const lines: Parsed[] = rawLines.map((line) => {
    const isBold = line.startsWith("*") && line.endsWith("*") && line.length > 2;
    const text   = isBold ? line.slice(1, -1) : line;
    const m      = text.match(/^([^:]+):\s*(.+)$/);
    return { text, isBold, key: m?.[1], val: m?.[2] };
  });

  const titleLine   = lines[0]?.isBold ? lines[0] : null;
  const bodyLines   = lines.filter((_, i) => !(i === 0 && lines[0].isBold));
  const normalLines = bodyLines.filter((l) => !l.isBold);
  const totalLines  = bodyLines.filter((l) => l.isBold);

  // ── height ──────────────────────────────────────────────────
  const H =
    8                          // top bar
    + 28 + 4                   // label
    + 32 + 20                  // title
    + 1 + 28                   // divider
    + normalLines.length * LINE
    + 1 + 28                   // divider
    + totalLines.length * (LINE + 10)
    + 1 + 24                   // divider
    + 48;                      // footer

  const canvas = document.createElement("canvas");
  canvas.width  = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // ── background ──────────────────────────────────────────────
  ctx.fillStyle = "#0c1a10";
  ctx.fillRect(0, 0, W, H);

  // subtle noise texture feel via horizontal lines
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let yy = 0; yy < H; yy += 3) ctx.fillRect(0, yy, W, 1);

  // top accent bar
  ctx.fillStyle = "#25d366";
  ctx.fillRect(0, 0, W, 6);

  let y = 32;

  // ── label ───────────────────────────────────────────────────
  ctx.font      = "600 11px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#25d366";
  ctx.letterSpacing = "2px";
  ctx.fillText(documentLabel.toLocaleUpperCase("pt-BR"), PAD, y);
  ctx.letterSpacing = "0px";
  y += 30;

  // ── title ───────────────────────────────────────────────────
  if (titleLine) {
    const clean = titleLine.text.replace(/^comprovante\s*/i, "").trim();
    ctx.font      = "bold 26px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(clean, PAD, y);
    y += 30;
  }
  y += 18;

  // ── helper ──────────────────────────────────────────────────
  function divider() {
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 28;
  }

  divider();

  // ── normal key-value lines ───────────────────────────────────
  for (const line of normalLines) {
    if (line.key && line.val) {
      ctx.font      = "400 15px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(line.key, PAD, y);

      ctx.font      = "500 15px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
      ctx.fillStyle = "#d1d5db";
      const vw = ctx.measureText(line.val).width;
      ctx.fillText(line.val, W - PAD - vw, y);
    } else {
      ctx.font      = "400 15px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(line.text, PAD, y);
    }
    y += LINE;
  }

  divider();

  // ── total lines ──────────────────────────────────────────────
  for (const line of totalLines) {
    if (line.key && line.val) {
      ctx.font      = "600 14px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(line.key.toUpperCase(), PAD, y);

      ctx.font      = "bold 24px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
      ctx.fillStyle = "#25d366";
      const vw = ctx.measureText(line.val).width;
      ctx.fillText(line.val, W - PAD - vw, y);
    } else {
      ctx.font      = "bold 20px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
      ctx.fillStyle = "#25d366";
      ctx.fillText(line.text, PAD, y);
    }
    y += LINE + 10;
  }

  divider();

  // ── footer ───────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  ctx.font      = "400 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#374151";
  ctx.fillText("Comprovante gerado automaticamente", PAD, y + 14);
  const dw = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, W - PAD - dw, y + 14);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))),
      "image/png",
    );
  });
}

/* ──────────────────────────────────────────────────────────────
   Component
   ────────────────────────────────────────────────────────────── */
export function WhatsAppReceiptButton({
  defaultPhone = "",
  message,
  title = "Enviar comprovante pelo WhatsApp",
  phoneLabel = "Número do cliente",
  autoOpen = false,
  documentLabel = "Comprovante",
  pdfButtonLabel = "Baixar como PDF",
}: Props) {
  const [phone, setPhone]           = useState(defaultPhone);
  const [countdown, setCountdown]   = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showText, setShowText]     = useState(false);
  const cancelledRef = useRef(false);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef   = useRef(message);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const isReady = phone.replace(/\D/g, "").length >= 10;

  function buildTextUrl(p: string) {
    const clean       = p.replace(/\D/g, "");
    const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(messageRef.current)}`;
  }

  // ── share image ─────────────────────────────────────────────
  async function handleShareImage() {
    setGenerating(true);
    setShareError(null);
    try {
      const blob = await generateReceiptImage(messageRef.current, documentLabel);
      const file = new File([blob], "comprovante.png", { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Comprovante" });
      } else {
        // Desktop fallback: download
        const url = URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href     = url;
        a.download = "comprovante.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setShareError("Não foi possível compartilhar. Tente baixar a imagem.");
      }
    } finally {
      setGenerating(false);
    }
  }

  // ── PDF export ──────────────────────────────────────────────
  function handleDownloadPDF() {
    const msg = messageRef.current;
    const lines = msg.split("\n");

    const titleLine = lines[0]?.startsWith("*") && lines[0]?.endsWith("*") ? lines[0].slice(1, -1) : null;
    const bodyLines = titleLine ? lines.slice(1) : lines;

    const rows = bodyLines.map((line) => {
      const isBold = line.startsWith("*") && line.endsWith("*") && line.length > 2;
      const text = isBold ? line.slice(1, -1) : line;
      const m = text.match(/^([^:]+):\s*(.+)$/);
      if (isBold) {
        if (m) return `<div class="total"><span class="total-k">${m[1]}</span><span class="total-v">${m[2]}</span></div>`;
        return `<div class="total"><span class="total-v">${text}</span></div>`;
      }
      if (m) return `<div class="row"><span class="k">${m[1]}</span><span class="v">${m[2]}</span></div>`;
      if (text.trim()) return `<div class="note">${text}</div>`;
      return "";
    }).join("");

    const logoUrl = `${window.location.origin}/infinity-logo.png`;
    const generatedAt = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${documentLabel} — ${titleLine ?? "Comprovante"}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a;padding:40px 36px;max-width:520px;margin:0 auto}
.header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:18px}
.header img{height:52px;width:auto;display:block}
.header .title{text-align:right}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#b8863f}
.header h1{font-size:19px;font-weight:800;letter-spacing:-.2px;margin-top:3px;color:#1a1a1a}
.rule{height:3px;background:linear-gradient(90deg,#d1a04f,#f0d98a 55%,transparent);border-radius:2px;margin-bottom:6px}
.meta{font-size:11px;color:#9a958b;margin-bottom:22px}
.card{border:1px solid #ececec;border-radius:14px;overflow:hidden}
.row{display:flex;justify-content:space-between;gap:14px;padding:11px 16px;font-size:13px;border-bottom:1px solid #f0f0f0}
.row:last-child{border-bottom:none}
.k{color:#8a857b}.v{font-weight:600;text-align:right;color:#1a1a1a}
.note{font-size:12px;color:#8a857b;padding:10px 16px;font-style:italic;border-bottom:1px solid #f0f0f0}
.total{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:14px 16px;background:#fbf6ea;border-top:2px solid #d1a04f}
.total-k{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a6a2f}
.total-v{font-size:19px;font-weight:800;color:#8a6a2f}
.footer{margin-top:26px;padding-top:14px;border-top:1px solid #ececec;display:flex;align-items:center;justify-content:space-between;gap:10px}
.footer p{font-size:10px;color:#b3ada1}
@media print{body{padding:18px}}
</style></head><body>
<div class="header">
  <img src="${logoUrl}" alt="Infinity" />
  <div class="title">
    <p class="eyebrow">${documentLabel}</p>
    <h1>${titleLine ? titleLine.replace(/^comprovante\s*/i, "").trim() || titleLine : ""}</h1>
  </div>
</div>
<div class="rule"></div>
<p class="meta">Gerado em ${generatedAt}</p>
<div class="card">${rows}</div>
<div class="footer">
  <p>Infinity ERP</p>
  <p>Comprovante gerado automaticamente</p>
</div>
</body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    const img = win.document.querySelector("img");
    const triggerPrint = () => win.print();
    if (img && !img.complete) {
      img.addEventListener("load", triggerPrint, { once: true });
      img.addEventListener("error", triggerPrint, { once: true });
      setTimeout(triggerPrint, 1200);
    } else {
      setTimeout(triggerPrint, 300);
    }
  }

  // ── text send ───────────────────────────────────────────────
  function handleSendText() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(null);
    window.open(buildTextUrl(phone), "_blank", "noopener,noreferrer");
  }

  function handleCancel() {
    cancelledRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCountdown(null);
  }

  useEffect(() => {
    if (!autoOpen || !isReady || cancelledRef.current) return;
    const START = 3;
    setCountdown(START);
    let remaining = START;
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setCountdown(null);
        if (!cancelledRef.current)
          window.open(buildTextUrl(phone), "_blank", "noopener,noreferrer");
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#25d366]/30 bg-[#0d1f14]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#25d366]/15 px-4 py-3">
        <MessageCircle className="size-4 text-[#25d366]" />
        <p className="text-sm font-semibold text-[#25d366]">{title}</p>
      </div>

      {/* Countdown */}
      {countdown !== null ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-[#25d366]">
            Abrindo WhatsApp em <strong>{countdown}s</strong>…
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#9a958b] transition hover:text-white"
          >
            <X className="size-3.5" />
            Cancelar
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Image share — PRIMARY */}
          <button
            type="button"
            onClick={handleShareImage}
            disabled={generating}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25d366] px-4 py-4 text-base font-bold text-[#0a1a10] shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition hover:bg-[#22c55e] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {generating
              ? <LoaderCircle className="size-5 animate-spin" />
              : <ImageIcon className="size-5" />}
            {generating ? "Gerando comprovante…" : "Compartilhar comprovante"}
          </button>

          {/* Error */}
          {shareError ? (
            <p className="text-xs text-[#f0a08f] text-center">{shareError}</p>
          ) : null}

          {/* PDF download */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/20 bg-transparent px-4 py-3 text-sm font-semibold text-[#25d366]/70 transition hover:bg-[#25d366]/8 hover:text-[#25d366]"
          >
            <FileDown className="size-4" />
            {pdfButtonLabel}
          </button>

          {/* Desktop note / text fallback toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowText((v) => !v)}
              className="text-xs text-[#25d366]/50 underline-offset-2 hover:text-[#25d366]/80 transition"
            >
              {showText ? "Ocultar opção de texto" : "Ou enviar como texto no WhatsApp"}
            </button>
          </div>

          {/* Text fallback */}
          {showText ? (
            <div className="space-y-2 pt-1 border-t border-[#25d366]/10">
              <div className="space-y-1.5">
                <p className="text-xs text-[#25d366]/60">{phoneLabel}</p>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(DDD) 9 9999-9999"
                  className="w-full rounded-xl border border-[#25d366]/20 bg-white/[0.04] px-4 py-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-[#25d366]/50 transition"
                />
              </div>
              <button
                type="button"
                onClick={handleSendText}
                disabled={!isReady}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/30 bg-transparent px-4 py-3 text-sm font-semibold text-[#25d366] transition hover:bg-[#25d366]/10 disabled:opacity-35"
              >
                <Send className="size-4" />
                Enviar texto agora
              </button>
            </div>
          ) : null}

          {/* Download hint for desktop */}
          <p className="text-center text-[11px] text-[#25d366]/30 leading-tight">
            No celular: compartilha direto para o WhatsApp.<br />
            No computador: baixa a imagem para enviar manualmente.
          </p>
        </div>
      )}
    </div>
  );
}
