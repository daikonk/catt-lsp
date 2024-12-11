import { documents, TextDocumentIdentifier } from "../../documents";
import { RequestMessage } from "../../server";
import { Range, Position } from "../../types";

interface DocumentDiagnosticParams {
  textDocument: TextDocumentIdentifier;
}

namespace DiagnosticSeverity {
  export const Error: 1 = 1;
  export const Warning: 2 = 2;
  export const Information: 3 = 3;
  export const Hint: 4 = 4;
}

type DiagnosticSeverity = 1 | 2 | 3 | 4;

interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  source: "Catt LSP";
  message: string;
  data?: unknown;
}

interface FullDocumentDiagnosticReport {
  kind: "full";
  items: Diagnostic[];
}

// Token types based on grammar
export type TokenType =
  | "KEYWORD"
  | "IDENTIFIER"
  | "NUMBER"
  | "STRING"
  | "OPERATOR"
  | "PUNCTUATION"
  | "UNKNOWN";

interface Token {
  type: TokenType;
  value: string;
  position: Position;
  length: number;
}

// Keywords from grammar
const keywords = new Set([
  "var",
  "return",
  "if",
  "else",
  "while",
  "for",
  "function",
  "true",
  "false",
  "null",
  "meow",
  "meowln",
]);

// Operators from grammar
const operators = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "==",
  "!=",
  "<",
  ">",
  "&&",
  "||",
  "!",
  "=",
  "[",
  "]",
  "(",
  ")",
  "}",
  "{",
  ";"
]);

const createDiagnostic = (
  start: Position,
  end: Position,
  message: string,
  severity: DiagnosticSeverity
): Diagnostic => ({
  range: { start, end },
  source: "Catt LSP",
  severity,
  message,
});

export const tokenize = (content: string): Token[] => {
  const tokens: Token[] = [];
  let current = 0;
  let line = 0;
  let character = 0;

  while (current < content.length) {
    let char = content[current] || "";

    if (/\s/.test(char)) {
      if (char === "\n") {
        line++;
        character = 0;
      } else {
        character++;
      }
      current++;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let value = "";
      const startPos = { line, character };

      while (current < content.length && /[0-9]/.test(content[current] || "")) {
        value += content[current];
        current++;
        character++;
      }

      tokens.push({
        type: "NUMBER",
        value,
        position: startPos,
        length: value.length,
      });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let value = "";
      const startPos = { line, character };

      while (
        current < content.length &&
        /[a-zA-Z0-9_]/.test(content[current] || "")
      ) {
        value += content[current];
        current++;
        character++;
      }

      const type = keywords.has(value) ? "KEYWORD" : "IDENTIFIER";
      tokens.push({
        type,
        value,
        position: startPos,
        length: value.length,
      });
      continue;
    }

    if (char === '"') {
      let value = char;
      const startPos = { line, character };
      current++;
      character++;

      while (current < content.length && content[current] !== '"') {
        value += content[current];
        current++;
        character++;
      }

      if (current < content.length && content[current] === '"') {
        value += '"';
        current++;
        character++;
      }

      tokens.push({
        type: "STRING",
        value,
        position: startPos,
        length: value.length,
      });
      continue;
    }

    if (operators.has(char)) {
      const startPos = { line, character };
      let value = char;

      if (current + 1 < content.length) {
        const nextChar = content[current + 1];
        if (operators.has(char + nextChar)) {
          value += nextChar;
          current++;
          character++;
        }
      }

      tokens.push({
        type: "OPERATOR",
        value,
        position: startPos,
        length: value.length,
      });
      current++;
      character++;
      continue;
    }

    tokens.push({
      type: "UNKNOWN",
      value: char,
      position: { line, character },
      length: 1,
    });
    current++;
    character++;
  }

  return tokens;
};

interface BlockContext {
  isIf: boolean;
  startToken: Token;
  startIndex: number;
  braceCount: number;
}

const validateSyntax = (tokens: Token[]): Diagnostic[] => {
    const diagnostics: Diagnostic[] = [];
    const declaredVariables = new Set<string>();
    const blockStack: BlockContext[] = [];
    let current = 0;
  
    const createError = (token: Token, message: string) => {
      const start = token.position;
      const end = {
        line: start.line,
        character: start.character + token.length,
      };
      return createDiagnostic(start, end, message, DiagnosticSeverity.Error);
    };
  
    while (current < tokens.length) {
      const token = tokens[current];
  
      if (token.value === "}") {
        if (blockStack.length > 0) {
          const block = blockStack[blockStack.length - 1];
          block.braceCount--;
          if (block.braceCount === 0) {
            blockStack.pop();
          }
        }
        current++;
        continue;
      }
  
      if (token.value === "{") {
        if (blockStack.length > 0 && blockStack[blockStack.length - 1].startIndex !== current) {
          blockStack[blockStack.length - 1].braceCount++;
        }
        current++;
        continue;
      }
  
      if (token.type === "UNKNOWN") {
        diagnostics.push(createError(token, `Unexpected character: ${token.value}`));
        current++;
        continue;
      }
  
      if (token.type === "KEYWORD") {
        switch (token.value) {
            case "var": {
                if (current + 1 >= tokens.length || tokens[current + 1].type !== "IDENTIFIER") {
                  diagnostics.push(
                    createError(token, "var keyword must be followed by an identifier")
                  );
                  current++;
                  continue;
                }
      
                if (current + 2 >= tokens.length || tokens[current + 2].value !== "=") {
                  diagnostics.push(
                    createError(tokens[current + 1], "var declaration requires initialization with '='")
                  );
                  current += 2;
                  continue;
                }
      
                declaredVariables.add(tokens[current + 1].value);
                
                current += 3;
      
                let foundSemicolon = false;
                while (current < tokens.length && tokens[current].value !== ";") {
                  if (tokens[current].type === "IDENTIFIER" && !declaredVariables.has(tokens[current].value)) {
                    diagnostics.push(
                      createError(
                        tokens[current],
                        `Undefined variable "${tokens[current].value}" in initialization`
                      )
                    );
                  }
                  current++;
                }
      
                if (current >= tokens.length || tokens[current].value !== ";") {
                  diagnostics.push(
                    createError(
                      tokens[current - 1],
                      "var declaration must end with semicolon"
                    )
                  );
                } else {
                  current++; 
                }
                continue;
              }
  
          case "meow":
          case "meowln": {
            if (current + 1 >= tokens.length || tokens[current + 1].value !== "(") {
              diagnostics.push(
                createError(
                  token,
                  `Invalid ${token.value} call. Expected "(" after "${token.value}"`
                )
              );
              current++;
              continue;
            }
  
            let parenCount = 1;
            current += 2;
  
            while (current < tokens.length && parenCount > 0) {
              if (tokens[current].value === "(") parenCount++;
              if (tokens[current].value === ")") parenCount--;
              current++;
            }
  
            if (parenCount > 0) {
              diagnostics.push(
                createError(token, `Unclosed parenthesis in ${token.value} call`)
              );
            }
            break;
          }
          case "for":
          case "while":
          case "if": {
            if (current + 1 >= tokens.length || tokens[current + 1].value !== "(") {
              diagnostics.push(
                createError(token, `Invalid ${token.value} statement. Expected "(" after "if"`)
              );
              current++;
              continue;
            }
  
            let parenCount = 1;
            current += 2;
  
            while (current < tokens.length && parenCount > 0) {
              if (tokens[current].value === "(") parenCount++;
              if (tokens[current].value === ")") parenCount--;
              current++;
            }
  
            if (parenCount > 0) {
              diagnostics.push(
                createError(token, `Unclosed parenthesis in ${token.value} condition`)
              );
              continue;
            }
  
            if (current < tokens.length && tokens[current].value === "{") {
              blockStack.push({
                isIf: true,
                startToken: token,
                startIndex: current,
                braceCount: 1,
              });
              current++;
            } else {
              diagnostics.push(
                createError(
                  tokens[current] || token,
                  `Expected block starting with "{" for ${token.value} statement`
                )
              );
            }
            break;
          }
  
          case "else": {
            const hasMatchingIf = blockStack.some((block) => block.isIf);
            if (!hasMatchingIf) {
              diagnostics.push(
                createError(token, "else statement without preceding if statement")
              );
              current++;
              continue;
            }
  
            current++;
  
            if (current < tokens.length && tokens[current].value === "if") {
              current++;
              if (current >= tokens.length || tokens[current].value !== "(") {
                diagnostics.push(
                  createError(
                    tokens[current - 1],
                    `Invalid else if statement. Expected "(" after "if"`
                  )
                );
                continue;
              }
  
              let parenCount = 1;
              current++;
  
              while (current < tokens.length && parenCount > 0) {
                if (tokens[current].value === "(") parenCount++;
                if (tokens[current].value === ")") parenCount--;
                current++;
              }
  
              if (parenCount > 0) {
                diagnostics.push(
                  createError(tokens[current - 1], "Unclosed parenthesis in else if condition")
                );
                continue;
              }
            }
  
            if (current < tokens.length && tokens[current].value === "{") {
              blockStack.push({
                isIf: false,
                startToken: token,
                startIndex: current,
                braceCount: 1,
              });
              current++;
            } else {
              diagnostics.push(
                createError(
                  tokens[current] || token,
                  'Expected block starting with "{" for else statement'
                )
              );
            }
            break;
          }
        }
      } else if (token.type === "IDENTIFIER" && !declaredVariables.has(token.value)) {
        diagnostics.push(
          createError(token, `Undefined variable "${token.value}"`)
        );
      }
  
      current++;
    }
  
    blockStack.forEach((block) => {
      if (block.braceCount > 0) {
        diagnostics.push(
          createError(
            block.startToken,
            `Unclosed block starting at position ${block.startIndex}`
          )
        );
      }
    });
  
    return diagnostics;
  };

export const diagnostic = (
  message: RequestMessage
): FullDocumentDiagnosticReport | null => {
  const params = message.params as DocumentDiagnosticParams;
  const content = documents.get(params.textDocument.uri);

  if (!content) {
    return null;
  }

  const tokens = tokenize(content);
  const diagnostics = validateSyntax(tokens);

  return {
    kind: "full",
    items: diagnostics,
  };
};