import { RequestMessage } from "../../server";
import { documents, TextDocumentIdentifier } from "../../documents";
import { Position } from "../../types";
import log from "../../log";

type CompletionItem = {
    label: string;
};

const words = ["var", "false", "true", "if", "else", "while", "for", "fn", "return", "meow", "meowln"]
const items = words.map((word) => {
    return { label: word };
})

interface CompletionList {
    isIncomplete: boolean;
    items: CompletionItem[];
}

interface TextDocumentPositionParams {
    textDocument: TextDocumentIdentifier;
    position: Position
}

export interface CompletionParams extends TextDocumentPositionParams {}

export const completion = (message : RequestMessage): CompletionList | null => {
    const params = message.params as CompletionParams;
    const content = documents.get(params.textDocument.uri);

    if (!content) {
        return null;
    }

    const currentLine = content?.split("\n")[params.position.line]
    const lineUntilCursor = currentLine.slice(0, params.position.character)
    const currentPref = lineUntilCursor.replace(/.*\W(.*?)/, "$1");

    const items = words
    .filter((word) => {
        return word.startsWith(currentPref);
    }).map((word) => {
        return {label: word};
    })

    log.write({
        completion: {
            currentLine, 
            lineUntilCursor, 
            currentPref
        }
    })

    return {
        isIncomplete: true,
        items,
    }
}