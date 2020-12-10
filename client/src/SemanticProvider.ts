import * as vscode from 'vscode';
import { traverse } from "@glas/traverse";
import Parser from "ionscript/lib/compiler/parser";
import { CallExpression, ClassDeclaration, Declarator, BreakStatement, ContinueStatement, ElementExpression, ForOfStatement, ForStatement, FunctionExpression, Identifier, IfStatement, Literal, MemberExpression, Parameter, Reference, RegularExpression, ReturnStatement, Typed, TypeExpression, VariableDeclaration, YieldExpression, AwaitExpression } from "ionscript/lib/compiler/ast";
const parser = new Parser();

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();

const legend = (function () {
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'member', 'macro', 'variable', 'parameter', 'property', 'label'
	];
	tokenTypesLegend.forEach((tokenType, index) => tokenTypes.set(tokenType, index));

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];
	tokenModifiersLegend.forEach((tokenModifier, index) => tokenModifiers.set(tokenModifier, index));

	return new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
})();

const astTypeToTokenType = {
	Literal: "string"
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'ionscript'}, new DocumentSemanticTokensProvider(), legend));
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

function add(position, offset) {
	return { line: position.line, column: position.column + offset }
}

const keywordTokenTypes = {
	let: ["macro"],
	var: ["variable", "readonly"],
	type: ["macro"],
	export: ["keyword"],
	default: ["keyword"],
	class: ["macro"],
	return: ["keyword"],
	yield: ["keyword"],
	else: ["keyword"],
	await: ["keyword"],
	async: ["keyword"],
}

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();

		function push(locationOrNode, tokenType, ...modifiers) {
			let { start, end } = locationOrNode.location ?? locationOrNode;

			let length = (start.line === end.line ? end.column : lines[start.line].length + 1) - start.column;
			//	TODO: add absolute positions to location information to simplify length calculation.
			// console.log(tokenType + ":" + modifiers.join(","))
			builder.push(start.line - 1, start.column - 1, length, self._encodeTokenType(tokenType), self._encodeTokenModifiers(modifiers));
		}

		function highlightStartingKeywords(line: number, max = 3) {
			let lineText = lines[line];
			let words = lineText.trim().split(/\s+/).slice(0, max);
			for (let word of words) {
				let tokenType = keywordTokenTypes[word];
				if (tokenType != null) {
					let column = lineText.indexOf(word) + 1;
					push({ start: { line, column }, end: { line, column: column + word.length } }, tokenType[0], ...tokenType.slice(1));
				}
			}
		}

		let text = document.getText();
		let lines = ["", ...text.split(/\r\n|\n/)]; // we add "" to 0 so lines are indexed starting at 1
		let self = this;

		try {
			let ast = parser.parse(text, document.fileName);
			traverse(ast, {
				enter(node) {
					if (node.location == null) {
						return;
					}
	
					if (TypeExpression.is(node)) {
						push(node.value, "type");
					}
	
					if (IfStatement.is(node)) {
						// colorize the if
						push({ start: node.location.start, end: add(node.location.start, "if".length) }, "keyword");
						if (node.alternate) {
							highlightStartingKeywords(node.alternate.location.start.line, 1);
						}
					}
					if (ForOfStatement.is(node) || ForStatement.is(node)) {
						push({ start: node.location.start, end: add(node.location.start, "for".length) }, "keyword");
						if (ForOfStatement.is(node)) {
							// highlight the "in"
							push({ start: add(node.left.id.location.end, 0), end: add(node.right.location.start, 0) }, "keyword");
						}
					}
	
					if (BreakStatement.is(node) || ContinueStatement.is(node)) {
						push(node, "keyword");
					}
	
					if (ReturnStatement.is(node) || YieldExpression.is(node) || AwaitExpression.is(node)) {
						highlightStartingKeywords(node.location.start.line, 1);
					}
	
					if (FunctionExpression.is(node)) {
						if (node.async) {
							// ideally this would be a token or location.
							push({ start: node.location.start, end: add(node.location.start, "async".length) }, "keyword");
						}
						if (node.id) {
							push(node.id, "function");
						}
					}
					if (CallExpression.is(node)) {
						let callee = node.callee as any;
						if (MemberExpression.is(callee)) {
							callee = callee.property;
						}
						if (Identifier.is(callee)) {
							push(callee, "function");
						}
					}
	
					if (Typed.is(node)) {
						if (node.type) {
							push(node.type, "type");
						}
					}
	
					if (VariableDeclaration.is(node)) {
						let right = (node.export === 2 ? node.value : node.id).location;
						// this will keyword color the let/const and export [default]
						highlightStartingKeywords(node.location.start.line)
	
						if (Identifier.is(node.id)) {
							push(node.id, "variable", "declaration", node.kind === "let" ? "readonly" : "");
						}
					}
	
					if (ClassDeclaration.is(node)) {
						highlightStartingKeywords(node.location.start.line)
					}
	
					if (ElementExpression.is(node)) {
						push(node.kind, "struct");
						if (node.close) {
							push(node.close, "struct");
						}
					}
	
					if (Literal.is(node)) {
						if (typeof node.value === "string") {
							push(node, "string");
							// could be an outline string.
							if (node.location.start.line < node.location.end.line) {
								for (let line = node.location.start.line; line < node.location.end.line; line++) {
									push({ start: { line, column: 1 }, end: { line, column: 100 } }, "string");
								}
							}
						}
						else if (typeof node.value === "number") {
							push(node, "number");
						}
						else if (typeof node.value === "boolean") {
							push(node, "number");
						}
						else if (node.value === null){
							push(node, "null");
						}
					}
					if (RegularExpression.is(node)) {
						push(node, "regexp");
					}
					if (Declarator.is(node)) {
						push(node, "variable", "declaration")
					}
					if (Reference.is(node)) {
						push(node, "variable")
					}
				}
			});
		}
		catch (e) {
		}
		// console.log(JSON.stringify(ast));

		// finally, let's highlight comments.
		for (let line = 1; line < lines.length; line++) {
			let lineText = lines[line];
			if (lineText.trim().startsWith("//")) {
				push({ start: { line, column: 1 }, end: { line, column: lineText.length + 1 }}, "comment");
			}
		}

		// sample of builderizing the tokens and stuff
		// builder.push(1, 5, 20, this._encodeTokenType("string"), this._encodeTokenModifiers([]));

		// allTokens.forEach((token) => {
		// 	builder.push(token.line, token.startCharacter, token.length, this._encodeTokenType(token.tokenType), this._encodeTokenModifiers(token.tokenModifiers));
		// });
		return builder.build();
	}

	private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === 'notInLegend') {
			return tokenTypes.size + 2;
		}
		return 0;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (let i = 0; i < strTokenModifiers.length; i++) {
			const tokenModifier = strTokenModifiers[i];
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			let currentOffset = 0;
			do {
				const openOffset = line.indexOf('[', currentOffset);
				if (openOffset === -1) {
					break;
				}
				const closeOffset = line.indexOf(']', openOffset);
				if (closeOffset === -1) {
					break;
				}
				const tokenData = this._parseTextToken(line.substring(openOffset + 1, closeOffset));
				r.push({
					line: i,
					startCharacter: openOffset + 1,
					length: closeOffset - openOffset - 1,
					tokenType: tokenData.tokenType,
					tokenModifiers: tokenData.tokenModifiers
				});
				currentOffset = closeOffset;
			} while (true);
		}
		return r;
	}

	private _parseTextToken(text: string): { tokenType: string; tokenModifiers: string[]; } {
		const parts = text.split('.');
		return {
			tokenType: parts[0],
			tokenModifiers: parts.slice(1)
		};
	}
}
