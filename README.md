# Catt-LSP

A basic LSP for the catt language, currently available through VSCode debugger and neovim.

clone the repo and npm install in root dir,
```
git clone https://github.com/daikonk/catt-lsp.git
cd catt-lsp
npm install
```

## To start LSP on VSCode

either use ctrl + d or ```npm run watch``` to start LSP server

any .txt file in your debugger environment or current project dir will be affected

## To start LSP on NeoVim

add this to your nvim config under

./nvim/after/ftplugin/text.lua

```
vim.lsp.start {
    name = "LSP From Scratch",
    cmd = {
        "npx", "ts-node",
        -- Update this with the path to your server.ts
        vim.fn.expand("~/src/lsp-from-scratch/server/src/server.ts")
    },
    capabilities = vim.lsp.protocol.make_client_capabilities()
}
```
