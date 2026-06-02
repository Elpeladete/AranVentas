$body = @{
  model = 'res.partner'
  method = 'search_read'
  args = @(,@(,@('name','ilike','aran')))
  kwargs = @{ fields = @('id','name','vat'); limit = 3 }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "REQUEST: $body"
try {
  $r = Invoke-WebRequest 'https://aranventas.vercel.app/api/odoo/execute' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 60
  Write-Host "STATUS: $($r.StatusCode)"
  Write-Host $r.Content
} catch {
  Write-Host "STATUS: $($_.Exception.Response.StatusCode.value__)"
  $s = $_.Exception.Response.GetResponseStream()
  (New-Object IO.StreamReader($s)).ReadToEnd() | Write-Host
}
