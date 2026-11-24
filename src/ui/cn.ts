import clsx, { type ClassValue } from "clsx";

/**
 * Joins class names. There is no merge step: when two classes set the same property the
 * stylesheet order wins, not the order written here. So never pass a class that fights one
 * the component already sets. Add a variant instead.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
