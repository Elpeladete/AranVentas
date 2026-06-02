$ErrorActionPreference = 'Continue'
$line = Get-Content .env.local | Where-Object { $_ -match '^ODOO_PASSWORD=' } | Select-Object -First 1
$val = ($line -split '=', 2)[1]
if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length-2) }
if ($val.StartsWith("'") -and $val.EndsWith("'")) { $val = $val.Substring(1, $val.Length-2) }
Write-Host ("PASSWORD length: {0}" -f $val.Length)
Write-Host ("Has special chars (! & | < > ^ %): {0}" -f ([bool]($val -match '[!&|<>^%]')))

$tmp = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllText($tmp, $val)

Write-Host "Removing existing ODOO_PASSWORD from production..."
cmd /c "vercel env rm ODOO_PASSWORD production --yes"

Write-Host "Re-adding ODOO_PASSWORD from file..."
cmd /c "type `"$tmp`" | vercel env add ODOO_PASSWORD production"

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "Done."
