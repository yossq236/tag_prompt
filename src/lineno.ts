export function getLinenoViewHtml(code: string): string {
    const lines = code.split('\n');
    const width = lines.length.toString().length;
    return lines.map((_,i) => ' ' + (' '.repeat(width) + (i + 1).toString()).slice(-width) + ' ').join('\n');
}
