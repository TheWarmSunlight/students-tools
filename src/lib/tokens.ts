import { nanoid } from "nanoid";

export function createAccessToken(size = 32): string {
  return nanoid(size);
}
