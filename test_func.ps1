$headers = @{
    'apikey' = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0'
    'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xc3RzeHVzY3FieG55ZWpoaXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NjAwMDksImV4cCI6MjEwNTMzNjAwOX0.1Em6nTniOf3xgQWQxBf0N6h_3WZqBHba5C17i7LJ5K0'
    'Content-Type' = 'application/json'
    'Prefer' = 'params=single-object'
}
$body = '{"p_token":"00000000-0000-0000-0000-000000000000","p_full_name":"test"}'
try {
    $result = Invoke-RestMethod -Method Post -Uri 'https://mqstsxuscqbxnyejhixk.supabase.co/rest/v1/rpc/update_customer_profile' -Headers $headers -Body $body
    $result
} catch {
    $_.Exception.Response | Select-Object -ExpandProperty StatusCode
    $_.Exception.Response | Select-Object -ExpandProperty StatusDescription
}