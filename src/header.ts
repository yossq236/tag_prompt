function split(code: string): Array<string> {
    const result = new Array<string>;
    const matches = code.matchAll(/[#]+|\/\/|\/\*|\*\/|\n/g);
    let cursor = 0;
    for (const match of matches) {
        if (cursor < match.index) {
            result.push(match.input.substring(cursor, match.index));
        }
        const word = match[0];
        result.push(word);
        cursor = match.index + word.length;
    }
    if (cursor < code.length) {
        result.push(code.substring(cursor));
    }
    return result;
}

interface Header {
    row: number;
    label: string;
    activeChars: number;
}

function summary(tokens: Array<string>): Array<Header> {
    const result = new Array<Header>;
    let row = 0;
    let header = false;
    let lineComment = false;
    let blockComment = false;
    let current: Header = {row: 0, label: '', activeChars: 0};
    for (const token of tokens) {
        switch(token){
            case '//':
                if (lineComment || blockComment) {
                } else if (header) {
                    header = false;
                    lineComment = true;
                } else {
                    lineComment = true;
                }
                break;
            case '/*':
                if (lineComment || blockComment) {
                } else if (header) {
                    header = false;
                    blockComment = true;
                } else {
                    blockComment = true;
                }
                break;
            case '*/':
                if (lineComment) {
                } else if (blockComment) {
                    blockComment = false;
                }
                break;
            case '\n':
                if (lineComment || header) {
                    header = lineComment = false;
                }
                row++;
                break;
            default:
                if (lineComment || blockComment) {
                } else if (header) {
                    current.label += token;
                } else if (token.startsWith('#')) {
                    if (lineComment || blockComment) {
                    } else if (header) {
                        current.label += token;
                    } else {
                        header = true;
                        if (current.label !== '') {
                            result.push(current);
                        }
                        current = {row: row, label: token, activeChars: 0};
                    }
                } else {
                    current.activeChars++;
                }
                break;
        }
    }
    if (current.label !== '') {
        result.push(current);
    }
    return result;
}

export function getHeaderViewHtml(code: string): string {
    const headers = summary(split(code));
    const enable = '[*]&nbsp;';
    const disable = '&nbsp;'.repeat(4);
    return headers.map<string>(v => '<option value="' + v.row + '">' + ((0 < v.activeChars) ? enable : disable) + v.label.trim() + '</option>').join('\n');
}

