# IonScript Language Server copied and modified from the Language Server Sample.

There is no grammar file for ionscript yet. We currently have only provided semantic highlighting which is more limited.
Parsing errors aren't very good yet and semantic errors are not amazing yet. Type descriptions need to be simplified for users.

## Kody, Orion: Just Install development version 

    git clone https://github.com/glassorg/ionscript-language-server.git

    cd ionscript-language-server

    code --install-extension ionscript-language-server-1.0.0.vsix

## TODO

Real textmate based grammar.
Improve Semantic Highlighting to use actual semantic information which would require steps beyond parsing (inferTypes).
Provide some refactoring options.
  Auto import of module dependencies would be my highest priority.

Modify compiler to return MULTIPLE semantic errors instead of the current first one.

## Running the Server

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'plain text' language mode.
  - Type `j` or `t` to see `Javascript` and `TypeScript` completion.
  - Enter text content such as `AAA aaa BBB`. The extension will emit diagnostics for all words in all-uppercase.

## Debugging
  Your editor must have the languageServerExample.trace.server = true in the settings.
  Then in the [Extension Development Host] you can view Output > Language Server Example to see console.logs from the server.
