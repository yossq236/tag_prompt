import { getHeaderViewHtml } from './header';
import { getLinenoViewHtml } from './lineno';
import { getHighlightViewHtml } from './highlight';
import { getSuggestionViewHtml } from './suggestion';

const workerContext = self as unknown as SharedWorkerGlobalScope;

workerContext.onconnect = (event: MessageEvent) => {
    const port = event.ports[0];
    port.onmessage = (event) => {
        port.postMessage({
            headerViewHtml: getHeaderViewHtml(event.data.text),
            linenoViewHtml: getLinenoViewHtml(event.data.text),
            highlightViewHtml: getHighlightViewHtml(event.data.text, event.data.selectionStart),
            suggestionViewHtml: (event.data.suggestion) ? getSuggestionViewHtml(event.data.text, event.data.selectionStart, event.data.selectionEnd) : '',
        });
    };
    port.start();
};

export default {};