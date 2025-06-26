local tsgopath = vim.fn.executable("tsgo")

local tsgo_enabled = false

if tsgopath and tsgo_enabled then
	vim.lsp.enable("vtsls", false)

	vim.lsp.enable("tsgo")
	vim.notify("Using tsgo instead of vtsls", vim.log.levels.WARN)
end
