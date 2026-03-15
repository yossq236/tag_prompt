import { TAGS } from './tags.ts';
import { MAX_SUGGESTION, ASCII_THRESHOLD } from './constants.ts';

interface Suggestion {
  approx: number;
  html: string;
}

export function getSuggestionViewHtml(text: string, start: number, end: number): string {
    const word = getWord(text, start);
    const result = new Array<Suggestion>;
    if (start === end && 0 < word.length) {
        for (const tag of TAGS) {
            if (tag.indexOf(word) !== -1) {
                result.push({approx: 100 - ((word.length / tag.length) * 100), html: '<option value="' + getValue(tag) + '">' + getText(tag) + '</option>'});
                if (!(result.length <= MAX_SUGGESTION)) break;
            }
        }
    }
    if (result.length === 0) {
        return '';
    } else {
        result.sort((n1, n2) => n1.approx - n2.approx);
        return result.map(n => n.html).join('');
    }
}

function getWord(text: string, start: number): string {
    let word_start = start;
    let word_end = start;
    for (let i = start - 1; 0 <= i && !isDelimiter(text.charAt(i)); word_start = i--);
    return text.substring(word_start, word_end);
}

function isDelimiter(c: string): boolean {
    return (c === ' ') || (c === ',') || (c === '\n') || (ASCII_THRESHOLD <= c.charCodeAt(0));
}

function getValue(tag: string): string {
    return tag.replaceAll(/[_()]/g, m => {
        switch(m){
        case '_':return ' ';
        case '(':return '\\(';
        case ')':return '\\)';
        }
        return m;
    });
}

function getText(tag: string): string {
    return tag.replaceAll('_', ' ');
}