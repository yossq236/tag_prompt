import { getHighlightViewHtml } from './highlight.ts';
import { getSuggestionViewHtml } from './suggestion.ts';

const workerContext = self as unknown as SharedWorkerGlobalScope;

workerContext.onconnect = (event: MessageEvent) => {
    const port = event.ports[0];
    port.onmessage = (event) => {
        port.postMessage({
            highlightViewHtml: getHighlightViewHtml(event.data.text, event.data.selectionStart),
            suggestionViewHtml: (event.data.suggestion) ? getSuggestionViewHtml(event.data.text, event.data.selectionStart, event.data.selectionEnd) : '',
        });
    };
    port.start();
};

export default {};