import type { ChangeEvent } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

function maskByPattern(value: string, pattern: string) {
  const digits = value.replace(/\D/g, "");
  let result = "";
  let digitIndex = 0;

  for (const char of pattern) {
    if (digitIndex >= digits.length) break;
    if (char === "#") {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += char;
    }
  }

  return result;
}

export function maskCpf(value: string) {
  return maskByPattern(value, "###.###.###-##");
}

export function maskCnpj(value: string) {
  return maskByPattern(value, "##.###.###/####-##");
}

export function maskCep(value: string) {
  return maskByPattern(value, "#####-###");
}

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return maskByPattern(value, digits.length > 10 ? "(##) #####-####" : "(##) ####-####");
}

export function withMask(registration: UseFormRegisterReturn, maskFn: (value: string) => string) {
  return {
    ...registration,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = maskFn(event.target.value);
      return registration.onChange(event);
    },
  };
}
