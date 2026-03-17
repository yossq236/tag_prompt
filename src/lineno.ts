export function getLinenoViewHtml(code: string): string {
    const lines = code.split('\n');
    return lines.map((_,i) => (i + 1).toString()).join('\n');
}
