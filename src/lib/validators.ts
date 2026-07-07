function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const digits = cpf.split("").map(Number);

  for (const [length, startWeight] of [[9, 10], [10, 11]] as const) {
    const sum = digits
      .slice(0, length)
      .reduce((acc, digit, index) => acc + digit * (startWeight - index), 0);
    const checkDigit = ((sum * 10) % 11) % 10;

    if (checkDigit !== digits[length]) {
      return false;
    }
  }

  return true;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);

  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const digits = cnpj.split("").map(Number);
  const weightsFor = (length: number) => {
    const base = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    return base.slice(base.length - length);
  };

  for (const length of [12, 13]) {
    const weights = weightsFor(length);
    const sum = digits
      .slice(0, length)
      .reduce((acc, digit, index) => acc + digit * weights[index], 0);
    const remainder = sum % 11;
    const checkDigit = remainder < 2 ? 0 : 11 - remainder;

    if (checkDigit !== digits[length]) {
      return false;
    }
  }

  return true;
}
