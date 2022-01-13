# debug-sp README

After installation, extension badge will appear in left corner of status bar.
Debug SP scans for available SP instance every 5s. When it find one, it connects.
Output can be found in Output tab _Skyrim Platform_

You need just print to browser console like this

```ts
browser.executeJavaScript('console.log("boop")');
```

TIP: you can translate all game console messages to Debug SP output with this little trick from SP docs

```ts
const htmlEscapes: Record<string, string> = {
    '"': '\\"',
    "'": "\\'",
    "\\": "\\\\",
    "<": "\\<",
    ">": "\\>",
};
const htmlEscaper = /[&<>"'\\\/]/g;
on("consoleMessage", (e) => {
    const msg = e.message.replace(htmlEscaper, (match) => htmlEscapes[match]);
    browser.executeJavaScript('console.log("Game >> ' + msg + '")');
});
```

To handle Debug SP input you should catch `browserMessage`

```ts
on("browserMessage", (event) => {
    // do something with event.arguments
    // maybe perform game command
});
```

CDP url hardcoded to http://localhost:9000 for now...
