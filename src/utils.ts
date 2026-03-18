import { ASCII_THRESHOLD } from './constants.ts';

export function isDelimiter(c: string): boolean {
    return (c === ' ') || (c === ',') || (c === '\n') || (ASCII_THRESHOLD <= c.charCodeAt(0));
}

export interface Cursor {
    column: number;
    row: number;
}

export function getCursor(text: string, position: number): Cursor {
    let row: number = 0;
    let last: number = -1;
    for (let i = -1; (i = text.indexOf('\n', i + 1)) !== -1 && i < position; last = i, row++);
    return {row: row, column: position - last - 1};
}
