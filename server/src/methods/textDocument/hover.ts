import { RequestMessage } from "../../server";
import { Position, Range } from "../../types";
import { documents, DocumentUri } from "../../documents"
import { wordUnderCursor } from "../../documents";

type HoverParams = {
    textDocument: {uri: DocumentUri };
    position: Position
}

type Hover = {
    contents: {
        kind: "markdown";
        value: string;
    };
    range: Range;
};

export const hover = (message: RequestMessage): Hover | null => {
    const params = message.params as HoverParams;
    const document = documents.get(params.textDocument.uri)
    if (!document) {
        return null;
    }

    const currentWord = wordUnderCursor(document, params.position)

    if (!currentWord) {
        return null;
    }

    return {
        contents: {
            kind: "markdown",
            value: "this is a test to see if i can see"
        },
        range: currentWord.range
    }
};