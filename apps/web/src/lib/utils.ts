import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges conditional class names and resolves Tailwind conflicts predictably. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
