$body = @{
  model = 'res.partner'
  method = 'search_read'
  args = @(,@(
    '|',
    @('name','ilike','aran'),
    @('parent_id','ilike','aran')
  ))
  kwargs = @{
    fields = @('id','name','vat','is_company','parent_id')
    limit = 5
    order = 'is_company desc, name asc'
  }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "REQUEST: $body"
try {
  $r = Invoke-WebRequest 'https://aranventas.vercel.app/api/odoo/execute' -Method POST -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 60
  Write-Host "STATUS: $($r.StatusCode)"
  Write-Host ($r.Content.Substring(0, [Math]::Min(600, $r.Content.Length)))
} catch {
  Write-Host "STATUS: $($_.Exception.Response.StatusCode.value__)"
  $s = $_.Exception.Response.GetResponseStream()
  (New-Object IO.StreamReader($s)).ReadToEnd() | Write-Host
}
