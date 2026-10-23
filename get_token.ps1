$headers = @{
    'Authorization' = 'Bearer sbp_v0_e3417023759a42de459b5ba71c0cb764132b4f28'
    'Content-Type' = 'application/json'
}
$sql = "SELECT token FROM public.customer_sessions LIMIT 1"
$json = '"' + $sql.Replace('"', '\"').Replace("`n", '\n').Replace("`r", '') + '"'
$body = '{"query": ' + $json + '}'
try {
    $response = Invoke-WebRequest -Method Post -Uri 'https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query' -Headers $headers -Body $body -UseBasicParsing
    $response.Content
} catch {
    $_.Exception.Response.StatusCode
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $reader.ReadToEnd()
}