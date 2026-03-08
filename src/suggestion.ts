import { TAGS } from './tags.ts';

interface Suggestion {
  approx: number;
  html: string;
}

export function getSuggestionViewHtml(text: string, start: number, end: number): string {
    let result: Array<Suggestion> = [];
    let count = 0;
    const word = getCursorWord(text, start);
    if (start === end && 0 < word.length) {
        for (const tag of TAGS) {
            if (tag.indexOf(word) !== -1) {
                result.push({approx: (word.length / tag.length) * 100, html: '<option value="' + getOptionValue(tag) + '">' + getOptionText(tag) + '</option>'});
                count++;
                if (50 < count) break;
            }
        }
    }
    if (0 < result.length) {
        result.sort((n1, n2) => n2.approx - n1.approx);
        return result.map(n => n.html).join('');
    } else {
        return '';
    }
}

function getCursorWord(text: string, start: number): string {
    let result = '';
    for (let i = start - 1; 0 <= i; i--) {
        const c = text.charAt(i);
        if (c === ' '  || c === ',' || c === '\n' || 255 < c.charCodeAt(0)) break;
        result += c;
    }
    if (0 < result.length) {
        return result.split('').reverse().join('').trim();
    } else {
        return '';
    }
}

function getOptionValue(tag: string): string {
    return tag.replaceAll(/[_\(\)]/g,(m) => {
        if (m === '_') {
            return ' ';
        } else if (m === '(') {
            return '\\(';
        } else if (m === ')') {
            return '\\)';
        }
        return m;
    });
}

function getOptionText(tag: string): string {
    return tag.replaceAll('_', ' ');
}