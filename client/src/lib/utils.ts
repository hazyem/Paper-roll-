import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format weight values consistently across the application
 * @param weight - Weight value to format
 * @returns Formatted weight string with kg unit or "No Data" if unavailable
 */
export function formatWeight(weight: any): string {
  if (!weight && weight !== 0) return "No Data";
  return `${Number(weight).toFixed(2)} kg`;
}
