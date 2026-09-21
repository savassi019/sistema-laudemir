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

type ReceiptLine = {
  text: string;
  isBold: boolean;
  key?: string;
  value?: string;
};

type ReceiptDocument = {
  title: string;
  identifier?: ReceiptLine;
  status?: ReceiptLine;
  information: ReceiptLine[];
  totals: ReceiptLine[];
};

function normalizeReceiptKey(value?: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function parseReceiptMessage(message: string): ReceiptDocument {
  const lines: ReceiptLine[] = message
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const isBold = line.startsWith("*") && line.endsWith("*") && line.length > 2;
      const text = (isBold ? line.slice(1, -1) : line).trim();
      const match = text.match(/^([^:]+):\s*(.+)$/);
      return { text, isBold, key: match?.[1]?.trim(), value: match?.[2]?.trim() };
    });
  const titleLine = lines[0]?.isBold ? lines[0] : null;
  const body = titleLine ? lines.slice(1) : lines;
  const identifier = body.find((line) => normalizeReceiptKey(line.key) === "comprovante");
  const status = body.find((line) => {
    const key = normalizeReceiptKey(line.key);
    return key === "situacao" || key === "status";
  });

  return {
    title: titleLine?.text ?? "Comprovante",
    identifier,
    status,
    information: body.filter(
      (line) => !line.isBold && line !== identifier && line !== status,
    ),
    totals: body.filter((line) => line.isBold),
  };
}

function escapeReceiptHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (ctx.measureText(word).width <= maxWidth) return [word];
      const pieces: string[] = [];
      let piece = "";
      for (const character of word) {
        const candidate = `${piece}${character}`;
        if (piece && ctx.measureText(candidate).width > maxWidth) {
          pieces.push(piece);
          piece = character;
        } else {
          piece = candidate;
        }
      }
      if (piece) pieces.push(piece);
      return pieces;
    });
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0]!;
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function loadReceiptLogo() {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const logo = new Image();
    logo.onload = () => resolve(logo);
    logo.onerror = () => resolve(null);
    logo.src = "/infinity-logo.png";
  });
}

async function generateReceiptImage(message: string, documentLabel: string): Promise<Blob> {
  const receipt = parseReceiptMessage(message);
  const W = 720;
  const SCALE = 2;
  const PAD = 54;
  const CONTENT_W = W - PAD * 2;
  const INFO_GAP = 24;
  const INFO_W = (CONTENT_W - INFO_GAP) / 2;
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d")!;

  measure.font = "500 20px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  const subtitleLines = wrapCanvasText(measure, receipt.title, CONTENT_W);

  measure.font = "600 18px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  const informationLayout = receipt.information.map((line) => ({
    ...line,
    valueLines: wrapCanvasText(measure, line.value ?? line.text, INFO_W),
  }));
  const informationRows: Array<typeof informationLayout> = [];
  for (let index = 0; index < informationLayout.length; index += 2) {
    informationRows.push(informationLayout.slice(index, index + 2));
  }
  const informationHeight = informationRows.reduce((sum, row) => {
    const rowHeight = Math.max(
      76,
      ...row.map((item) => 30 + item.valueLines.length * 25),
    );
    return sum + rowHeight;
  }, 0);

  measure.font = "800 38px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  const totalLayout = receipt.totals.map((line, index) => {
    const valueLines = wrapCanvasText(measure, line.value ?? line.text, CONTENT_W - 56);
    const height = index === 0
      ? (line.key ? 28 : 0) + valueLines.length * 44 + 28
      : 24 + (line.key ? 28 : 0) + valueLines.length * 30 + 24;
    return { ...line, valueLines, height };
  });

  const headerHeight =
    220 +
    subtitleLines.length * 26 +
    (receipt.identifier ? 20 : 0) +
    (receipt.status ? 50 : 0);
  const detailsHeight = receipt.information.length > 0 ? 46 + informationHeight : 0;
  const summaryPanelHeight = totalLayout.length > 0
    ? 74 + totalLayout.reduce((sum, total) => sum + total.height, 0) + 12
    : 0;
  const summaryHeight = summaryPanelHeight > 0 ? summaryPanelHeight + 28 : 0;
  const footerHeight = 104;
  const H = headerHeight + detailsHeight + summaryHeight + footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#fbfcfa";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#18794e";
  ctx.fillRect(0, 0, W, 8);

  let y = 40;
  const logo = await loadReceiptLogo();
  if (logo) {
    const logoWidth = 112;
    const logoHeight = logoWidth / (logo.naturalWidth / logo.naturalHeight);
    ctx.drawImage(logo, PAD, y, logoWidth, logoHeight);
  } else {
    ctx.font = "800 21px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("INFINITY ERP", PAD, y + 28);
  }

  const documentText = documentLabel.toLocaleUpperCase("pt-BR");
  ctx.font = "700 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  const documentWidth = ctx.measureText(documentText).width + 28;
  ctx.fillStyle = "#edf7f0";
  ctx.beginPath();
  ctx.roundRect(W - PAD - documentWidth, y + 8, documentWidth, 34, 17);
  ctx.fill();
  ctx.fillStyle = "#17603d";
  ctx.fillText(documentText, W - PAD - documentWidth + 14, y + 30);

  y += 100;
  ctx.font = "800 30px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#17211a";
  ctx.fillText("COMPROVANTE DE FECHAMENTO", PAD, y);
  y += 36;

  ctx.font = "500 20px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#5d675f";
  for (const line of subtitleLines) {
    ctx.fillText(line, PAD, y);
    y += 26;
  }

  if (receipt.identifier?.value) {
    ctx.font = "600 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = "#89918b";
    ctx.fillText(`IDENTIFICADOR  ${receipt.identifier.value}`, PAD, y + 5);
    y += 30;
  } else {
    y += 10;
  }

  if (receipt.status?.value) {
    const statusText = receipt.status.value.toLocaleUpperCase("pt-BR");
    ctx.font = "700 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
    const badgeWidth = Math.min(ctx.measureText(statusText).width + 30, CONTENT_W);
    ctx.fillStyle = "#e8f5ec";
    ctx.beginPath();
    ctx.roundRect(PAD, y, badgeWidth, 34, 17);
    ctx.fill();
    ctx.fillStyle = "#17603d";
    ctx.fillText(statusText, PAD + 15, y + 22);
    y += 50;
  }

  ctx.strokeStyle = "#dfe5e0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 34;

  if (receipt.information.length > 0) {
    ctx.font = "700 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = "#6d766f";
    ctx.fillText("INFORMAÇÕES DO FECHAMENTO", PAD, y);
    y += 34;

    informationRows.forEach((row, rowIndex) => {
      const rowHeight = Math.max(
        76,
        ...row.map((item) => 30 + item.valueLines.length * 25),
      );
      row.forEach((item, column) => {
        const x = PAD + column * (INFO_W + INFO_GAP);
        if (item.key) {
          ctx.font = "700 11px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
          ctx.fillStyle = "#7d867f";
          ctx.fillText(item.key.toLocaleUpperCase("pt-BR"), x, y);
        }
        ctx.font = "600 18px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
        ctx.fillStyle = "#1d2821";
        item.valueLines.forEach((line, lineIndex) => {
          ctx.fillText(line, x, y + 27 + lineIndex * 25);
        });
      });
      y += rowHeight;
      if (rowIndex < informationRows.length - 1) {
        ctx.strokeStyle = "#edf0ed";
        ctx.beginPath();
        ctx.moveTo(PAD, y - 14);
        ctx.lineTo(W - PAD, y - 14);
        ctx.stroke();
      }
    });
    y += 12;
  }

  if (totalLayout.length > 0) {
    const panelTop = y;
    ctx.fillStyle = "#f0f7f2";
    ctx.strokeStyle = "#d7e7db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(PAD, panelTop, CONTENT_W, summaryPanelHeight, 18);
    ctx.fill();
    ctx.stroke();

    y += 36;
    ctx.font = "700 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
    ctx.fillStyle = "#587061";
    ctx.fillText("RESUMO DO FECHAMENTO", PAD + 28, y);
    y += 38;

    totalLayout.forEach((total, index) => {
      const x = PAD + 28;
      if (index > 0) {
        ctx.strokeStyle = "#d9e6dc";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(W - PAD - 28, y);
        ctx.stroke();
        y += 24;
      }
      if (total.key) {
        ctx.font = "700 11px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
        ctx.fillStyle = index === 0 ? "#28704b" : "#6f7c73";
        ctx.fillText(total.key.toLocaleUpperCase("pt-BR"), x, y);
        y += 28;
      }
      ctx.font = `${index === 0 ? "800 38px" : "700 24px"} system-ui,-apple-system,'Segoe UI',Arial,sans-serif`;
      ctx.fillStyle = index === 0 ? "#18794e" : "#26332b";
      total.valueLines.forEach((line, lineIndex) => {
        ctx.fillText(line, x, y + lineIndex * (index === 0 ? 44 : 30));
      });
      y += total.valueLines.length * (index === 0 ? 44 : 30);
      y += index === 0 ? 28 : 24;
    });
    y = panelTop + summaryPanelHeight + 28;
  }

  const footerTop = H - footerHeight + 18;
  ctx.strokeStyle = "#dfe5e0";
  ctx.beginPath();
  ctx.moveTo(PAD, footerTop);
  ctx.lineTo(W - PAD, footerTop);
  ctx.stroke();
  const generatedAt = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  ctx.font = "600 12px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#58635b";
  ctx.fillText("Infinity ERP", PAD, H - 52);
  ctx.font = "400 11px system-ui,-apple-system,'Segoe UI',Arial,sans-serif";
  ctx.fillStyle = "#8a938c";
  ctx.fillText("Comprovante gerado automaticamente pelo sistema.", PAD, H - 29);
  const dateWidth = ctx.measureText(generatedAt).width;
  ctx.fillText(generatedAt, W - PAD - dateWidth, H - 29);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar imagem"))),
      "image/png",
    );
  });
}

export function WhatsAppReceiptButton({
  defaultPhone = "",
  message,
  title = "Enviar comprovante pelo WhatsApp",
  phoneLabel = "Número do cliente",
  autoOpen = false,
  documentLabel = "Comprovante",
  pdfButtonLabel = "Baixar como PDF",
}: Props) {
  const [phone, setPhone] = useState(defaultPhone);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageRef = useRef(message);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  const isReady = phone.replace(/\D/g, "").length >= 10;

  function buildTextUrl(value: string) {
    const clean = value.replace(/\D/g, "");
    const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(messageRef.current)}`;
  }

  async function handleShareImage() {
    setGenerating(true);
    setShareError(null);
    try {
      const blob = await generateReceiptImage(messageRef.current, documentLabel);
      const file = new File([blob], "comprovante.png", { type: "image/png" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Comprovante" });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "comprovante.png";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setShareError("Não foi possível compartilhar. Tente baixar a imagem.");
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleDownloadPDF() {
    const receipt = parseReceiptMessage(messageRef.current);
    const logoUrl = `${window.location.origin}/infinity-logo.png`;
    const generatedAt = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const informationHtml = receipt.information
      .map((line) => {
        const label = line.key
          ? `<p class="info-label">${escapeReceiptHtml(line.key)}</p>`
          : "";
        return `<div class="info-item">${label}<p class="info-value">${escapeReceiptHtml(line.value ?? line.text)}</p></div>`;
      })
      .join("");
    const totalsHtml = receipt.totals
      .map((line, index) => `
        <div class="summary-item ${index === 0 ? "primary" : "secondary"}">
          ${line.key ? `<p class="summary-label">${escapeReceiptHtml(line.key)}</p>` : ""}
          <p class="summary-value">${escapeReceiptHtml(line.value ?? line.text)}</p>
        </div>`)
      .join("");
    const statusHtml = receipt.status?.value
      ? `<span class="status">${escapeReceiptHtml(receipt.status.value)}</span>`
      : "";
    const identifierHtml = receipt.identifier?.value
      ? `<p class="identifier">Identificador&nbsp;&nbsp;${escapeReceiptHtml(receipt.identifier.value)}</p>`
      : "";

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeReceiptHtml(documentLabel)} — ${escapeReceiptHtml(receipt.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:14mm}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:#edf1ee;color:#17211a;padding:28px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:100%;max-width:620px;margin:0 auto;background:#fbfcfa;border-top:6px solid #18794e;padding:34px 40px 28px;box-shadow:0 12px 35px rgba(24,55,37,.08)}
.brand-row{display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand-row img{display:block;width:104px;height:auto;object-fit:contain}
.document-label{border-radius:999px;background:#edf7f0;color:#17603d;padding:8px 13px;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap}
.heading{margin-top:30px}
.heading h1{font-size:25px;line-height:1.12;letter-spacing:-.035em;font-weight:850;color:#17211a}
.subtitle{margin-top:8px;font-size:16px;line-height:1.4;font-weight:550;color:#5d675f;overflow-wrap:anywhere}
.identifier{margin-top:12px;font-size:10px;line-height:1.5;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#89918b;overflow-wrap:anywhere}
.status{display:inline-flex;margin-top:18px;border-radius:999px;background:#e8f5ec;color:#17603d;padding:8px 13px;font-size:10px;font-weight:800;letter-spacing:.055em;text-transform:uppercase}
.section{margin-top:28px;padding-top:24px;border-top:1px solid #dfe5e0}
.section-title{font-size:10px;font-weight:800;letter-spacing:.105em;text-transform:uppercase;color:#6d766f}
.info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 28px;margin-top:22px}
.info-item{min-width:0}
.info-label{font-size:10px;line-height:1.3;font-weight:800;letter-spacing:.065em;text-transform:uppercase;color:#7d867f}
.info-value{margin-top:5px;font-size:15px;line-height:1.45;font-weight:650;color:#1d2821;overflow-wrap:anywhere}
.summary{margin-top:28px;border:1px solid #d7e7db;border-radius:16px;background:#f0f7f2;padding:26px 28px 24px}
.summary-title{font-size:10px;font-weight:800;letter-spacing:.105em;text-transform:uppercase;color:#587061}
.summary-item{padding-top:22px}
.summary-item.secondary{margin-top:22px;border-top:1px solid #d9e6dc}
.summary-label{font-size:10px;line-height:1.3;font-weight:800;letter-spacing:.075em;text-transform:uppercase;color:#28704b}
.summary-item.secondary .summary-label{color:#6f7c73}
.summary-value{margin-top:8px;overflow-wrap:anywhere}
.summary-item.primary .summary-value{font-size:33px;line-height:1.08;font-weight:850;letter-spacing:-.035em;color:#18794e}
.summary-item.secondary .summary-value{font-size:21px;line-height:1.15;font-weight:750;color:#26332b}
.footer{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-top:32px;padding-top:20px;border-top:1px solid #dfe5e0}
.company{font-size:11px;font-weight:800;color:#58635b}
.footer-note,.generated-at{margin-top:5px;font-size:9px;line-height:1.45;color:#8a938c}
.generated-at{text-align:right;white-space:nowrap}
@media(max-width:480px){body{padding:0;background:#fbfcfa}.sheet{padding:26px 24px 24px;box-shadow:none}.brand-row img{width:90px}.heading h1{font-size:22px}.info-grid{gap:18px 20px}.summary{padding:23px 22px}.summary-item.primary .summary-value{font-size:29px}.footer{align-items:flex-start;flex-direction:column;gap:8px}.generated-at{text-align:left}}
@media print{body{background:#fff;padding:0}.sheet{max-width:none;padding:0;box-shadow:none;border-top-width:5px}}
</style></head><body>
<main class="sheet">
  <header>
    <div class="brand-row">
      <img src="${logoUrl}" alt="Infinity"/>
      <span class="document-label">${escapeReceiptHtml(documentLabel)}</span>
    </div>
    <div class="heading">
      <h1>COMPROVANTE DE FECHAMENTO</h1>
      <p class="subtitle">${escapeReceiptHtml(receipt.title)}</p>
      ${identifierHtml}
      ${statusHtml}
    </div>
  </header>
  ${informationHtml ? `<section class="section"><p class="section-title">Informações do fechamento</p><div class="info-grid">${informationHtml}</div></section>` : ""}
  ${totalsHtml ? `<section class="summary"><p class="summary-title">Resumo do fechamento</p>${totalsHtml}</section>` : ""}
  <footer class="footer">
    <div><p class="company">Infinity ERP</p><p class="footer-note">Comprovante gerado automaticamente pelo sistema.</p></div>
    <p class="generated-at">${escapeReceiptHtml(generatedAt)}</p>
  </footer>
</main>
</body></html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    const image = printWindow.document.querySelector("img");
    const triggerPrint = () => printWindow.print();
    if (image && !image.complete) {
      image.addEventListener("load", triggerPrint, { once: true });
      image.addEventListener("error", triggerPrint, { once: true });
      setTimeout(triggerPrint, 1200);
    } else {
      setTimeout(triggerPrint, 300);
    }
  }

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
        if (!cancelledRef.current) {
          window.open(buildTextUrl(phone), "_blank", "noopener,noreferrer");
        }
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#25d366]/30 bg-[#0d1f14]">
      <div className="flex items-center gap-2 border-b border-[#25d366]/15 px-4 py-3">
        <MessageCircle className="size-4 text-[#25d366]" />
        <p className="text-sm font-semibold text-[#25d366]">{title}</p>
      </div>

      {countdown !== null ? (
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-[#25d366]">
            Abrindo WhatsApp em <strong>{countdown}s</strong>…
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[#9a958b] transition active:text-white"
          >
            <X className="size-3.5" />
            Cancelar
          </button>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <button
            type="button"
            onClick={handleShareImage}
            disabled={generating}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#25d366] px-4 py-4 text-base font-bold text-[#0a1a10] shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition active:scale-[0.98] active:bg-[#22c55e] disabled:opacity-40 disabled:shadow-none"
          >
            {generating ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : (
              <ImageIcon className="size-5" />
            )}
            {generating ? "Gerando comprovante…" : "Compartilhar comprovante"}
          </button>

          {shareError ? <p className="text-center text-xs text-[#f0a08f]">{shareError}</p> : null}

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/20 bg-transparent px-4 py-3 text-sm font-semibold text-[#25d366]/70 transition active:bg-[#25d366]/10 active:text-[#25d366]"
          >
            <FileDown className="size-4" />
            {pdfButtonLabel}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowText((current) => !current)}
              className="min-h-11 text-xs text-[#25d366]/50 underline-offset-2 transition active:text-[#25d366]/80"
            >
              {showText ? "Ocultar opção de texto" : "Ou enviar como texto no WhatsApp"}
            </button>
          </div>

          {showText ? (
            <div className="space-y-2 border-t border-[#25d366]/10 pt-3">
              <div className="space-y-1.5">
                <p className="text-xs text-[#25d366]/60">{phoneLabel}</p>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(DDD) 9 9999-9999"
                  className="min-h-12 w-full rounded-xl border border-[#25d366]/20 bg-white/[0.04] px-4 py-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-[#25d366]/50"
                />
              </div>
              <button
                type="button"
                onClick={handleSendText}
                disabled={!isReady}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/30 bg-transparent px-4 py-3 text-sm font-semibold text-[#25d366] transition active:bg-[#25d366]/10 disabled:opacity-35"
              >
                <Send className="size-4" />
                Enviar texto agora
              </button>
            </div>
          ) : null}

          <p className="text-center text-[11px] leading-tight text-[#25d366]/30">
            No celular: compartilha direto para o WhatsApp.
            <br />
            No computador: baixa a imagem para enviar manualmente.
          </p>
        </div>
      )}
    </div>
  );
}
