import { ASCII_THRESHOLD } from './constants.ts';

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