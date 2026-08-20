export function titleCase(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatExperience(minimum: number | null, maximum: number | null) {
  if (minimum === null && maximum === null) return "Experience not specified";
  if (minimum === null) return `Up to ${maximum} years`;
  if (maximum === null) return `${minimum}+ years`;
  if (minimum === maximum) return `${minimum} years`;
  return `${minimum}–${maximum} years`;
}

function lakhs(value: number) {
  const amount = value / 100_000;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

export function formatSalary(minimum: number | null, maximum: number | null) {
  if (minimum === null && maximum === null) return "Salary not disclosed";
  if (minimum === null) return `Up to ₹${lakhs(maximum!)} LPA`;
  if (maximum === null) return `₹${lakhs(minimum)}+ LPA`;
  if (minimum === maximum) return `₹${lakhs(minimum)} LPA`;
  return `₹${lakhs(minimum)}–${lakhs(maximum)} LPA`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
