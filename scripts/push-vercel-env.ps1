$ErrorActionPreference = 'Continue'
$envs = @{}
Get-Content .env.local | Where-Object { $_ -match '^[A-Z][A-Z0-9_]*=' } | ForEach-Object {
  $parts = $_ -split '=', 2
  $envs[$parts[0]] = $parts[1].Trim('"').Trim("'")
}
$keys = @('ODOO_URL','ODOO_DB','ODOO_USERNAME','ODOO_PASSWORD')
foreach ($k in $keys) {
  $val = $envs[$k]
  if (-not $val) { Write-Host "skip $k (no value)"; continue }
  foreach ($env in @('production','preview','development')) {
    Write-Host "==> $k @ $env"
    # Usamos cmd para evitar NativeCommandError de PS al redirigir stderr.
    cmd /c "echo $val| vercel env add $k $env --force"
  }
}
