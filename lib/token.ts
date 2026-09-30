// lib/token.ts
import { randomBytes } from 'node:crypto';

/** 128-bit random, URL-safe. */
export function randomToken(): string {
  return randomBytes(16).toString('base64url');
}
