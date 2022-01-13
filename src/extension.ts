import { generateKeyPair } from 'crypto';
import * as vscode from 'vscode';
var axios = require('axios').default;
var cdp = require("chrome-remote-interface");

let status = false;
let runtime: any;

let sb: vscode.StatusBarItem;
let terminal: vscode.Terminal;
const writeEmitter = new vscode.EventEmitter<string>();
const defaultLine = "\x1b[1;96m→ \x1b[0m";
const returnLine = "\x1b[1;96m← \x1b[0m";
let content = defaultLine;


const keys = {
	enter: "\r",
	backspace: "\x7f",
	left: "\x1b[D",
	right: "\x1b[C",
	up: "\x1b[A",
	down: "\x1b[B",
};
const actions = {
	cursorBack: "\x1b[D",
	deleteChar: "\x1b[P",
	clear: "\x1b[2J\x1b[3J\x1b[;H",
};
const symbol = {
	check: "\x1b[1;92m✔\x1b[0m",
	x: "\x1b[1;91m✘\x1b[0m",
	i: "\x1b[1;93m⬤\x1b[0m",
};

export function activate(context: vscode.ExtensionContext) {

	// handle workspaces
	const workspaceRoots: readonly vscode.WorkspaceFolder[] | undefined =
		vscode.workspace.workspaceFolders;
	if (!workspaceRoots || !workspaceRoots.length) {
		// no workspace root
		return "";
	}
	const workspaceRoot: string = workspaceRoots[0].uri.fsPath || "";

	const pty = {
		onDidWrite: writeEmitter.event,
		open: () => {
			writeLine(`Welcome to Debug SP terminal!`);
			writeLine(`${symbol.i} searching for SP CDP`);
		},
		close: () => { },
		handleInput: async (char: string) => {
			switch (char) {
				case keys.enter: {
					// preserve the run command line for history
					writeEmitter.fire(`\r${content}\r\n`);
					// trim off leading default prompt
					const command = content.slice(defaultLine.length);
					if (command === 'clear') {
						writeEmitter.fire(actions.clear);
						content = defaultLine;
						writeEmitter.fire(`\r${content}`);
						return;
					}
					if (!status) {
						writeEmitter.fire(`${symbol.x} CDP not connected\r\n`);
					} else {
						console.log('command');
						runtime.callFunctionOn({
							functionDeclaration: "function() { window.skyrimPlatform.sendMessage(" + command + "); }",
							silent: false,
							returnByValue: true,
							executionContextId: 1
						});
					}
					content = defaultLine;
					writeEmitter.fire(`\r${content}`);
					return;
				}
				case keys.backspace: {
					if (content.length <= defaultLine.length) {
						return;
					}
					// remove last character
					content = content.substr(0, content.length - 1);
					writeEmitter.fire(actions.cursorBack);
					writeEmitter.fire(actions.deleteChar);
					return;
				}
				case keys.up:
				case keys.down:
				case keys.left:
				case keys.right: {
					return;
				};
				default: {
					// typing a new character
					content += char;
					writeEmitter.fire(char);
				}
			}
		},
	};
	terminal = (<any>vscode.window).createTerminal({
		name: `Skyrim Platform`,
		pty,
		iconPath: new vscode.ThemeIcon('flame')
	});
	console.log('⚠️ activate extension');
	sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(sb);
	sb.text = `$(extensions-refresh~spin) SP: init`;
	sb.show();
	const ws = searchCDP();
}

export function searchCDP() {
	const url = 'http://localhost:9000/json';
	var wsUrl: any = null;
	sb.text = `$(notebook-state-error~spin) SP: no cdp`;
	axios.get(url)
		.then(function (response: any) {
			if (response.status === 200) {
				console.log('⚠️ found CDP');
				wsUrl = response.data[0].webSocketDebuggerUrl;
				writeLine(`${symbol.check} found CDP, ws url: ${wsUrl}`);
				console.log(wsUrl);
				connectWs(wsUrl);
			}
		})
		.catch(function (error: any) {
			console.log('⛔️ cant find CDP, rescanning');
			setTimeout(searchCDP, 5000);
			sb.text = `$(notebook-state-error~spin) SP: no cdp`;
		});
}

export function connectWs(wsUrl: string) {
	const options = {
		target: wsUrl,
	};

	cdp(options, (client: any) => {
		runtime = client.Runtime;
		runtime.consoleAPICalled((entry: any) => {
			console.log(
				entry.args.map((arg: any) => arg.value).join("|")
			);
			console.log(entry);
			//oc.appendLine('>> ' + entry.args.map((arg: any) => arg.value));
			entry.args.map((arg: any) => {
				switch (arg.type) {
					case 'string': {
						writeLine(`${returnLine}${arg.value}`);
						break;
					}
					case 'number': {
						writeLine(`${returnLine}${blue(arg.value)}`);
						break;
					}
					case 'object': {
						if (arg.preview?.properties) {
							let arr: string[] = [];
							arg.preview.properties.map((prop: any) => {
								switch (prop.type) {
									case 'boolean': {
										arr.push(pink(prop.value));
										break;
									}
									case 'number': {
										arr.push(blue(prop.value));
										break;
									}
									case 'string': {
										arr.push('"' + yellow(prop.value) + '"');
										break;
									}
									case 'Object': {
										arr.push(prop.value);
										break;
									}
									default: {
										arr.push(prop.value);
										break;
									}
								}
							});

							writeLine(`${returnLine}[${arr.join(',')}]`);
						}
					}

				}
			});
		});
		runtime.executionContextCreated((entry: any) => {
			console.log(entry);
		});
		Promise.all([runtime.enable()]);
		console.log("connected!");
		writeLine(`${symbol.check} successfully connected to SP CDP`);
		status = true;
		terminal.show(true);
		sb.text = `$(extensions-remote) SP: connected`;
		client.once("disconnect", () => {
			sb.text = `$(notebook-state-error~spin) SP: no cdp`;
			writeLine(`${symbol.x} connection lost, reconnecting`);
			writeLine(`${symbol.i} searching for SP CDP`);
			status = false;
			searchCDP();
		});
	});

}

function writeLine(line: string) {
	writeEmitter.fire(`\r${line}\r\n`);
	writeEmitter.fire(`\r${content}`);
}

function yellow(text: any) {
	return `\x1b[0;93m${text}\x1b[0m`;
}

function blue(text: any) {
	return `\x1b[0;94m${text}\x1b[0m`;
}

function pink(text: any) {
	return `\x1b[0;91m${text}\x1b[0m`;
}


export function deactivate() { }




