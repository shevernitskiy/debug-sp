import * as vscode from 'vscode';
var axios = require('axios').default;
var cdp = require("chrome-remote-interface");

let oc: vscode.OutputChannel;
let sb: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
	oc = vscode.window.createOutputChannel('Skyrim Platform');
	console.log('⚠️activate extension');
	sb = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(sb);
	sb.text = `$(extensions-refresh~spin) SP: init`;
	sb.show();
	oc.appendLine('⚠️searching for SP CDP');
	const ws = searchCDP();
}

export function searchCDP() {
	const url = 'http://localhost:9000/json';
	var wsUrl: any = null;
	sb.text = `$(notebook-state-error~spin) SP: no cdp`;
	axios.get(url)
	.then(function (response: any) {
	  if (response.status === 200) {
		console.log('⚠️found CDP');
		vscode.window.showInformationMessage("Connected to Skyrim Platform");
		wsUrl = response.data[0].webSocketDebuggerUrl;
		oc.appendLine(`⚠️found CDP, ws url: ${wsUrl}`);
		console.log(wsUrl);
		connectWs(wsUrl);
	  }
	})
	.catch(function (error: any) {
		console.log('⛔️cant find CDP, rescanning');
		setTimeout(searchCDP, 5000);
		sb.text = `$(notebook-state-error~spin) SP: no cdp`;
	});
}

export function connectWs(wsUrl: string) {
	const options = {
		target: wsUrl,
	};

	cdp(options, (client: any) => {
		client.Runtime.consoleAPICalled((entry: any) => {
			console.log(
					entry.args.map((arg: any) => arg.value).join("|")
			);
			oc.appendLine('>> ' + entry.args.map((arg: any) => arg.value).join(" "));
		});
		Promise.all([client.Runtime.enable()]);
		console.log("connected!");
		oc.appendLine('✅successfully connected to SP CDP');
		oc.show(true);
		sb.text = `$(extensions-remote) SP: connected`;
		client.once("disconnect", () => {
			sb.text = `$(notebook-state-error~spin) SP: no cdp`;
			oc.appendLine('⛔️connection lost, reconnecting');
			oc.appendLine('⚠️searching for SP CDP');
			searchCDP();
		});
	});

}

export function deactivate() {}




