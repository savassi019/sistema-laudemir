"use client";

import { FileDown, ImageIcon, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  defaultPhone?: string;
  message: string;
  title?: string;
  phoneLabel?: string;
  autoOpen?: boolean;
  closedAt?: string;
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

function getReceiptTimestamp(closedAt?: string) {
  const timestamp = closedAt ? new Date(closedAt) : new Date();
  return Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;
}

async function generateReceiptImage(
  message: string,
  documentLabel: string,
  closedAt?: string,
): Promise<Blob> {
  const receipt = parseReceiptMessage(message);
  const W = 404;
  const SCALE = 3;
  const FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
  const OUTER = 12;
  const CARD_X = OUTER;
  const CARD_W = W - OUTER * 2;
  const CONTENT_X = 40;
  const CONTENT_W = 332;
  const DETAIL_GAP = 24;
  const DETAIL_W = (CONTENT_W - DETAIL_GAP) / 2;
  const measureCanvas = document.createElement("canvas");
  const measure = measureCanvas.getContext("2d")!;
  const logo = await loadReceiptLogo();

  measure.font = `800 19px ${FONT}`;
  const headingLines = wrapCanvasText(measure, "COMPROVANTE DE FECHAMENTO", CONTENT_W);
  measure.font = `400 13px ${FONT}`;
  const subtitleLines = wrapCanvasText(measure, receipt.title, CONTENT_W);

  measure.font = `600 14px ${FONT}`;
  const informationLayout = receipt.information.map((line) => ({
    ...line,
    valueLines: wrapCanvasText(measure, line.value ?? line.text, DETAIL_W),
  }));
  const informationRows: Array<typeof informationLayout> = [];
  for (let index = 0; index < informationLayout.length; index += 2) {
    informationRows.push(informationLayout.slice(index, index + 2));
  }

  const informationHeight = informationRows.reduce((sum, row, index) => {
    const rowHeight = Math.max(
      ...row.map((item) => 16 + item.valueLines.length * 19),
    );
    return sum + rowHeight + (index === informationRows.length - 1 ? 0 : 16);
  }, 0);

  const primaryTotal = receipt.totals[0];
  const secondaryTotals = receipt.totals.slice(1);
  measure.font = `800 31px ${FONT}`;
  const primaryValueLines = primaryTotal
    ? wrapCanvasText(measure, primaryTotal.value ?? primaryTotal.text, 190)
    : [];
  measure.font = `800 27px ${FONT}`;
  const secondaryLayout = secondaryTotals.map((line) => ({
    ...line,
    valueLines: wrapCanvasText(measure, line.value ?? line.text, CONTENT_W),
  }));

  const logoWidth = 58;
  const logoHeight = logo ? logoWidth / (logo.naturalWidth / logo.naturalHeight) : 28;
  const brandHeight = Math.max(logoHeight, 22);
  const headerHeight =
    26 +
    brandHeight +
    25 +
    headingLines.length * 24 +
    5 +
    subtitleLines.length * 18 +
    10 +
    18;
  const mainValueContentHeight = primaryTotal
    ? (primaryTotal.key ? 15 : 0) + primaryValueLines.length * 34
    : 0;
  const mainValueHeight = primaryTotal ? Math.max(75, mainValueContentHeight + 26) : 0;
  const detailsHeight = receipt.information.length > 0
    ? 1 + 15 + 10 + 17 + informationHeight + 10 + 1
    : 0;
  const balanceContentHeight = secondaryLayout.reduce(
    (sum, total, index) =>
      sum +
      (total.key ? 17 : 0) +
      total.valueLines.length * 30 +
      (index === secondaryLayout.length - 1 ? 0 : 20),
    0,
  );
  const balanceHeight = secondaryLayout.length > 0 ? 44 + balanceContentHeight : 0;
  const footerHeight = 85;
  const cardHeight =
    headerHeight +
    mainValueHeight +
    (primaryTotal ? 17 : 0) +
    detailsHeight +
    balanceHeight +
    footerHeight;
  const H = cardHeight + OUTER * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#f2f4f7";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.shadowColor = "rgba(16,24,40,.12)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(CARD_X, OUTER, CARD_W, cardHeight, 14);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(CARD_X, OUTER, CARD_W, cardHeight, 14);
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(CARD_X, OUTER, CARD_W, cardHeight);
  ctx.textBaseline = "top";

  let y = OUTER + 26;
  if (logo) {
    ctx.drawImage(logo, CONTENT_X, y, logoWidth, logoHeight);
  } else {
    ctx.font = `800 13px ${FONT}`;
    ctx.fillStyle = "#111827";
    ctx.fillText("INFINITY ERP", CONTENT_X, y + 7);
  }

  const documentText = documentLabel.toLocaleUpperCase("pt-BR");
  ctx.font = `700 7px ${FONT}`;
  const documentWidth = ctx.measureText(documentText).width + 20;
  ctx.fillStyle = "#f5f6f8";
  ctx.beginPath();
  ctx.roundRect(CARD_X + CARD_W - 18 - documentWidth, y, documentWidth, 22, 11);
  ctx.fill();
  ctx.fillStyle = "#5f6878";
  ctx.fillText(documentText, CARD_X + CARD_W - 18 - documentWidth + 10, y + 8);

  y += brandHeight + 25;
  ctx.font = `800 19px ${FONT}`;
  ctx.fillStyle = "#111827";
  headingLines.forEach((line) => {
    ctx.fillText(line, CONTENT_X, y);
    y += 24;
  });

  y += 5;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = "#697386";
  for (const line of subtitleLines) {
    ctx.fillText(line, CONTENT_X, y);
    y += 18;
  }

  y += 10;
  ctx.strokeStyle = "#e1e5ea";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CONTENT_X, y + 0.5);
  ctx.lineTo(CONTENT_X + CONTENT_W, y + 0.5);
  ctx.stroke();
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.roundRect(CONTENT_X, y - 1, 39, 3, 1.5);
  ctx.fill();
  y += 18;

  if (primaryTotal) {
    const panelX = CARD_X + 11;
    const panelW = CARD_W - 22;
    const panelTop = y;
    ctx.fillStyle = "#f7f8fa";
    ctx.beginPath();
    ctx.roundRect(panelX, panelTop, panelW, mainValueHeight, 12);
    ctx.fill();

    let primaryY = panelTop + 15;
    if (primaryTotal.key) {
      ctx.font = `750 8px ${FONT}`;
      ctx.fillStyle = "#697386";
      ctx.fillText(primaryTotal.key.toLocaleUpperCase("pt-BR"), panelX + 23, primaryY);
      primaryY += 15;
    }
    ctx.font = `800 31px ${FONT}`;
    ctx.fillStyle = "#111827";
    primaryValueLines.forEach((line, index) => {
      ctx.fillText(line, panelX + 23, primaryY + index * 34);
    });

    if (receipt.status?.value) {
      const statusText = receipt.status.value;
      ctx.font = `500 8px ${FONT}`;
      const statusWidth = Math.min(ctx.measureText(statusText).width, 100);
      const statusX = panelX + panelW - 14 - statusWidth;
      const statusY = panelTop + (mainValueHeight - 8) / 2;
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(statusX - 11, statusY + 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#667085";
      ctx.fillText(statusText, statusX, statusY);
    }
    y = panelTop + mainValueHeight + 17;
  }

  if (receipt.information.length > 0) {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CONTENT_X, y + 0.5);
    ctx.lineTo(CONTENT_X + CONTENT_W, y + 0.5);
    ctx.stroke();
    y += 16;

    ctx.font = `750 8px ${FONT}`;
    ctx.fillStyle = "#667085";
    ctx.fillText("INFORMAÇÕES DO FECHAMENTO", CONTENT_X, y);
    y += 27;

    informationRows.forEach((row, rowIndex) => {
      const rowHeight = Math.max(...row.map((item) => 16 + item.valueLines.length * 19));
      row.forEach((item, column) => {
        const x = CONTENT_X + column * (DETAIL_W + DETAIL_GAP);
        if (item.key) {
          ctx.font = `750 8px ${FONT}`;
          ctx.fillStyle = "#697386";
          ctx.fillText(item.key.toLocaleUpperCase("pt-BR"), x, y);
        }
        ctx.font = `600 14px ${FONT}`;
        ctx.fillStyle = "#111827";
        item.valueLines.forEach((line, lineIndex) => {
          ctx.fillText(line, x, y + 16 + lineIndex * 19);
        });
      });
      y += rowHeight + (rowIndex === informationRows.length - 1 ? 0 : 16);
    });
    y += 10;

    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(CONTENT_X, y + 0.5);
    ctx.lineTo(CONTENT_X + CONTENT_W, y + 0.5);
    ctx.stroke();
    y += 1;
  }

  if (secondaryLayout.length > 0) {
    y += 22;
    secondaryLayout.forEach((total, totalIndex) => {
      if (total.key) {
        ctx.font = `750 8px ${FONT}`;
        ctx.fillStyle = "#697386";
        ctx.fillText(total.key.toLocaleUpperCase("pt-BR"), CONTENT_X, y);
        y += 17;
      }
      ctx.font = `800 27px ${FONT}`;
      ctx.fillStyle = "#111827";
      total.valueLines.forEach((line, lineIndex) => {
        ctx.fillText(line, CONTENT_X, y + lineIndex * 30);
      });
      y += total.valueLines.length * 30;
      if (totalIndex < secondaryLayout.length - 1) y += 20;
    });
    y += 22;
  }

  const footerTop = OUTER + cardHeight - footerHeight;
  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(CONTENT_X, footerTop + 0.5);
  ctx.lineTo(CONTENT_X + CONTENT_W, footerTop + 0.5);
  ctx.stroke();

  const receiptTimestamp = getReceiptTimestamp(closedAt);
  const generatedDate = receiptTimestamp.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const generatedTime = receiptTimestamp.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const footerY = footerTop + 27;
  ctx.font = `700 11px ${FONT}`;
  ctx.fillStyle = "#111827";
  ctx.fillText("Infinity ERP", CONTENT_X, footerY);
  ctx.font = `400 7px ${FONT}`;
  ctx.fillStyle = "#98a2b3";
  ctx.fillText("Documento gerado automaticamente", CONTENT_X, footerY + 16);

  const footerMeta = [
    `${generatedDate} ${generatedTime}`,
    receipt.identifier?.value ? `ID: ${receipt.identifier.value}` : "",
  ].filter(Boolean);
  ctx.font = `400 7px ${FONT}`;
  footerMeta.forEach((line, index) => {
    const width = ctx.measureText(line).width;
    ctx.fillStyle = "#7b8494";
    ctx.fillText(line, CONTENT_X + CONTENT_W - width, footerY + index * 13);
  });
  const dividerX = CONTENT_X + CONTENT_W - 100;
  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(dividerX, footerY);
  ctx.lineTo(dividerX, footerY + 30);
  ctx.stroke();
  ctx.restore();

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
  closedAt,
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
    const withCountry = clean.startsWith("55") && clean.length >= 12 ? clean : `55${clean}`;
    return `https://wa.me/${withCountry}?text=${encodeURIComponent(messageRef.current)}`;
  }

  async function handleShareImage() {
    setGenerating(true);
    setShareError(null);
    try {
      const blob = await generateReceiptImage(messageRef.current, documentLabel, closedAt);
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
    const receiptTimestamp = getReceiptTimestamp(closedAt);
    const generatedDate = receiptTimestamp.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const generatedTime = receiptTimestamp.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const informationHtml = receipt.information
      .map((line) => {
        const label = line.key
          ? `<span class="field-label">${escapeReceiptHtml(line.key)}</span>`
          : "";
        return `<div class="detail">${label}<strong>${escapeReceiptHtml(line.value ?? line.text)}</strong></div>`;
      })
      .join("");
    const primaryTotal = receipt.totals[0];
    const balanceHtml = receipt.totals
      .slice(1)
      .map((line) => `
        <div class="balance-item">
          ${line.key ? `<span class="field-label">${escapeReceiptHtml(line.key)}</span>` : ""}
          <strong>${escapeReceiptHtml(line.value ?? line.text)}</strong>
        </div>`)
      .join("");
    const statusHtml = receipt.status?.value
      ? `<div class="closing-status"><span class="status-dot"></span><span>${escapeReceiptHtml(receipt.status.value)}</span></div>`
      : "";
    const identifierHtml = receipt.identifier?.value
      ? `<span>ID: ${escapeReceiptHtml(receipt.identifier.value)}</span>`
      : "";
    const mainValueHtml = primaryTotal
      ? `<section class="receipt-main-value">
          <div class="main-value-content">
            ${primaryTotal.key ? `<span class="field-label">${escapeReceiptHtml(primaryTotal.key)}</span>` : ""}
            <strong class="main-value">${escapeReceiptHtml(primaryTotal.value ?? primaryTotal.text)}</strong>
          </div>
          ${statusHtml}
        </section>`
      : "";

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeReceiptHtml(documentLabel)} — ${escapeReceiptHtml(receipt.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:14mm}
body{background:#f5f6f8;padding:28px 16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.receipt{width:100%;max-width:620px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;color:#101828;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 18px 60px rgba(16,24,40,.08)}
.receipt-header{padding:38px 38px 30px}.receipt-brand{display:flex;justify-content:space-between;align-items:flex-start;gap:30px}.receipt-logo{width:92px;height:auto;object-fit:contain}.receipt-copy{padding:9px 15px;background:#f5f6f8;border-radius:999px;color:#5f6878;font-size:11px;font-weight:700;letter-spacing:.04em;white-space:nowrap}.receipt-heading{margin-top:38px}.receipt-heading h1{font-size:28px;line-height:1.08;font-weight:800;letter-spacing:-.9px;color:#111827}.receipt-heading p{margin-top:10px;color:#697386;font-size:18px;line-height:1.4}.heading-line{position:relative;height:1px;margin-top:27px;background:#e1e5ea}.heading-line span{position:absolute;top:-2px;left:0;width:62px;height:4px;border-radius:999px;background:#2563eb}
.receipt-main-value{margin:0 28px;padding:28px 26px;display:flex;justify-content:space-between;align-items:center;gap:28px;border-radius:18px;background:#f7f8fa}.field-label{display:block;color:#697386;font-size:11px;line-height:1;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.main-value{display:block;margin-top:10px;color:#111827;font-size:43px;line-height:1;font-weight:800;letter-spacing:-1.8px;overflow-wrap:anywhere}.closing-status{display:flex;align-items:center;gap:10px;flex-shrink:0;color:#667085;font-size:13px;font-weight:500}.status-dot{width:10px;height:10px;border-radius:50%;background:#2563eb}
.receipt-details{margin:28px 38px 0;padding:28px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}.receipt-details h2{margin:0 0 26px;color:#667085;font-size:12px;font-weight:750;letter-spacing:.05em}.details-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 50px}.detail{min-width:0}.detail strong{display:block;margin-top:8px;color:#111827;font-size:19px;line-height:1.35;font-weight:600;overflow-wrap:anywhere}
.receipt-balance{margin:0 38px;padding:30px 0}.receipt-balance strong{display:block;margin-top:10px;color:#111827;font-size:32px;line-height:1;font-weight:800;letter-spacing:-1px;overflow-wrap:anywhere}.balance-item+.balance-item{margin-top:24px}
.receipt-footer{margin:0 38px;padding:27px 0 32px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end;gap:25px}.footer-brand{display:flex;flex-direction:column;gap:5px}.footer-brand strong{color:#111827;font-size:14px;font-weight:700}.footer-brand span{color:#98a2b3;font-size:10px}.footer-meta{display:flex;flex-direction:column;align-items:flex-end;gap:5px;padding-left:25px;border-left:1px solid #e5e7eb;color:#7b8494;font-size:10px;white-space:nowrap}
@media(max-width:520px){body{padding:0}.receipt{border-radius:18px}.receipt-header{padding:28px 24px 24px}.receipt-logo{width:74px}.receipt-heading{margin-top:28px}.receipt-heading h1{font-size:23px}.receipt-heading p{font-size:14px}.receipt-main-value{margin:0 18px;padding:23px 20px;align-items:flex-start;flex-direction:column;gap:16px}.main-value{font-size:37px}.receipt-details{margin-left:24px;margin-right:24px}.details-grid{gap:24px 20px}.detail strong{font-size:16px}.receipt-balance{margin-left:24px;margin-right:24px}.receipt-footer{margin-left:24px;margin-right:24px}}
@media print{body{background:#fff;padding:0}.receipt{max-width:none;border-radius:0;box-shadow:none}}
</style></head><body>
<main class="receipt">
  <header class="receipt-header">
    <div class="receipt-brand">
      <img src="${logoUrl}" alt="Infinity" class="receipt-logo"/>
      <span class="receipt-copy">${escapeReceiptHtml(documentLabel)}</span>
    </div>
    <div class="receipt-heading">
      <h1>COMPROVANTE DE FECHAMENTO</h1>
      <p>${escapeReceiptHtml(receipt.title)}</p>
      <div class="heading-line"><span></span></div>
    </div>
  </header>
  ${mainValueHtml}
  ${informationHtml ? `<section class="receipt-details"><h2>INFORMAÇÕES DO FECHAMENTO</h2><div class="details-grid">${informationHtml}</div></section>` : ""}
  ${balanceHtml ? `<section class="receipt-balance">${balanceHtml}</section>` : ""}
  <footer class="receipt-footer">
    <div class="footer-brand"><strong>Infinity ERP</strong><span>Documento gerado automaticamente</span></div>
    <div class="footer-meta"><span>${escapeReceiptHtml(generatedDate)} ${escapeReceiptHtml(generatedTime)}</span>${identifierHtml}</div>
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
    setShareError(null);
    if (!isReady) {
      setShowText(true);
      setShareError("Cadastre ou confira o telefone do cliente para abrir o WhatsApp.");
      return;
    }
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
            onClick={handleSendText}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-[#25d366] px-4 py-4 text-base font-bold text-[#0a1a10] shadow-[0_6px_20px_rgba(37,211,102,0.4)] transition active:scale-[0.98] active:bg-[#22c55e] disabled:opacity-40 disabled:shadow-none"
          >
            <MessageCircle className="size-5" />
            Enviar comprovante ao cliente
          </button>

          {shareError ? <p className="text-center text-xs text-[#f0a08f]">{shareError}</p> : null}

          <button
            type="button"
            onClick={handleShareImage}
            disabled={generating}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#25d366]/20 bg-transparent px-4 py-3 text-sm font-semibold text-[#25d366]/70 transition active:bg-[#25d366]/10 active:text-[#25d366] disabled:opacity-40"
          >
            {generating ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ImageIcon className="size-4" />
            )}
            {generating ? "Gerando comprovante…" : "Compartilhar imagem do comprovante"}
          </button>

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
              {showText ? "Ocultar telefone" : "Conferir ou alterar telefone"}
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
            O botão verde abre o WhatsApp no telefone cadastrado do cliente.
            <br />
            A imagem também pode ser compartilhada ou baixada separadamente.
          </p>
        </div>
      )}
    </div>
  );
}
