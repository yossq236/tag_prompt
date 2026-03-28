import { TAGS } from './tags';
import { MAX_SUGGESTION } from './constants';
import { getEditingWord } from './utils';

interface Suggestion {
  order: number;
  html: string;
}

export function getSuggestionViewHtml(text: string, start: number, end: number): string {
    const word = getEditingWord(text, start);
    const result = new Array<Suggestion>;
    if (start === end && 0 < word.length) {
        for (const tag of TAGS) {
            if (tag.indexOf(word) !== -1) {
                result.push({order: 100 - ((word.length / tag.length) * 100), html: '<option value="' + getValue(tag) + '">' + getText(tag) + '</option>'});
                if (!(result.length <= MAX_SUGGESTION)) break;
            }
        }
    }
    if (result.length === 0) {
        return '';
    } else {
        result.sort((n1, n2) => n1.order - n2.order);
        return result.map(n => n.html).join('');
    }
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