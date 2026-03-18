export function getLinenoViewHtml(code: string): string {
    const lines = code.split('\n');
    const width = lines.length.toString().length;
    return lines.map((_,i) => '<span> ' + (' '.repeat(width) + (i + 1).toString()).slice(-width) + ' </span>').join('\n');
}
