import { ASCII_THRESHOLD } from './constants';

export function isDelimiter(c: string): boolean {
    return (c === ' ') || (c === ',') || (c === '\n') || (ASCII_THRESHOLD <= c.charCodeAt(0));
}

export function el<T extends HTMLElement,TC extends HTMLElement>(tagName: string, className?: string | undefined, attributes?: Record<string,string> | undefined, children?: Array<TC> | undefined): T {
    const element = document.createElement(tagName) as T;
    if (className) {
        element.className = className;
    }
    if (attributes) {
        Object.entries(attributes).forEach(([k,v]) => {
            element.setAttribute(k,v);
        });
    }
    if (children) {
        children.forEach(e => element.appendChild(e));
    }
    return element;
}

export interface Cursor {
    position: number;
    column: number;
    row: number;
}

export function getCursor(text: string, position: number): Cursor {
    const target = text.substring(0, position);
    const row = (target.match(/\n/g) || []).length;
    const column = position - target.lastIndexOf('\n') - 1;
    return {position: position, row: row, column: column};
}

export function getEditingWord(text: string, position: number): string {
    let word_start = position;
    let word_end = position;
    for (let i = position - 1; 0 <= i && !isDelimiter(text.charAt(i)); word_start = i--);
    return text.substring(word_start, word_end);
}
