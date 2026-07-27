"use client";

import { Camera, CheckCircle2, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

type Props = {
  registration: UseFormRegisterReturn;
  label?: string;
  hint?: string;
  required?: boolean;
};

export function PhotoCaptureInput({ registration, label, hint, required }: Props) {
  const { ref: regRef, onChange, ...restReg } = registration;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const prev = URL.createObjectURL(file);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return prev;
      });
    }
    onChange(e);
  }

  function handleClear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFileName(null);
    // Notify RHF that the field is now empty
    onChange({
      target: { ...inputRef.current, files: null, value: "", type: "file", name: restReg.name },
    } as unknown as React.ChangeEvent<HTMLInputElement>);
  }

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-sm font-medium text-[#e8e0d1]">
          {label}
          {required && <span className="ml-0.5 text-[#f87171]">*</span>}
        </p>
      )}

      <input
        {...restReg}
        ref={(el) => {
          inputRef.current = el;
          if (typeof regRef === "function") regRef(el);
          else if (regRef && "current" in regRef) {
            (regRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }
        }}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
      />

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-[#8aa17c]/30 bg-[#0b0f0e]/72">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={fileName ?? "Foto capturada"}
              className="h-48 w-full object-cover"
            />
            <button
              type="button"
              onClick={handleClear}
              aria-label="Remover foto"
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-xl bg-black/70 text-white backdrop-blur transition hover:bg-black/90"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <CheckCircle2 className="size-3.5 shrink-0 text-[#8aa17c]" />
              <p className="truncate text-xs text-[#9a958b]">{fileName}</p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="shrink-0 text-xs font-medium text-[#d1a04f] hover:underline"
            >
              Trocar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[rgba(245,241,232,0.14)] bg-white/[0.02] px-4 py-5 text-left transition hover:border-[#d1a04f]/35 hover:bg-[#d1a04f]/5 active:scale-[0.99]"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
            <Camera className="size-5 text-[#9a958b]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#c9c2b4]">Tirar foto</p>
            <p className="text-[11px] text-[#5a544c]">
              {hint ?? "Abre câmera · ou escolha da galeria"}
            </p>
          </div>
          <ImagePlus className="ml-auto size-4 shrink-0 text-[#5a544c]" />
        </button>
      )}
    </div>
  );
}
