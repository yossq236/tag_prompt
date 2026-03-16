import { ASCII_THRESHOLD } from './constants.ts';

export function isDelimiter(c: string): boolean {
    return (c === ' ') || (c === ',') || (c === '\n') || (ASCII_THRESHOLD <= c.charCodeAt(0));
}
