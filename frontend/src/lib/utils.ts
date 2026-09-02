import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function safeNumber(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export function safeFormat(value: any, fractionDigits: number = 1, fallback: string = "0.0"): string {
  const num = safeNumber(value, NaN);
  if (isNaN(num)) return fallback;
  return num.toFixed(fractionDigits);
}
