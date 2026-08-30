param([string]$Root = ".", [int]$Port = 8000)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
$base = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $raw = $ctx.Request.Url.AbsolutePath
        $rel = $raw.TrimStart('/').Replace('/', '\')
        $path = [System.IO.Path]::GetFullPath((Join-Path $base $rel))
        if (-not $path.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
            $ctx.Response.StatusCode = 403
            $ctx.Response.Close()
            continue
        }
        if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path 'index.html' }
        if (Test-Path -LiteralPath $path) {
            $ext = [System.IO.Path]::GetExtension($path).ToLower()
            $ct = switch ($ext) {
                '.html'  { 'text/html; charset=utf-8' }
                '.css'   { 'text/css; charset=utf-8' }
                '.js'    { 'application/javascript; charset=utf-8' }
                '.json'  { 'application/json' }
                '.png'   { 'image/png' }
                '.jpg'   { 'image/jpeg' }
                '.jpeg'  { 'image/jpeg' }
                '.svg'   { 'image/svg+xml' }
                '.gif'   { 'image/gif' }
                '.ico'   { 'image/x-icon' }
                '.txt'   { 'text/plain; charset=utf-8' }
                '.md'    { 'text/plain; charset=utf-8' }
                '.pdf'   { 'application/pdf' }
                default  { 'application/octet-stream' }
            }
            $bytes = [System.IO.File]::ReadAllBytes($path)
            $ctx.Response.ContentType = $ct
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
        }
        $ctx.Response.Close()
    } catch {
        try { $ctx.Response.Close() } catch {}
    }
}