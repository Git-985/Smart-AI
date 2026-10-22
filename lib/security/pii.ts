const patterns: Array<[string, RegExp]> = [
  ["phone", /(?<!\d)1[3-9]\d{9}(?!\d)/g],
  ["id_number", /(?<!\d)\d{17}[\dXx](?!\d)/g],
];

export function maskSensitiveText(input: string): string {
  return patterns.reduce((text, [kind, pattern]) => {
    return text.replace(pattern, (value) =>
      kind === "phone" ? `${value.slice(0, 3)}****${value.slice(-4)}` : `${value.slice(0, 3)}************${value.slice(-2)}`,
    );
  }, input);
}
