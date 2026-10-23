$headers = @{
    'Authorization' = 'Bearer sbp_v0_e3417023759a42de459b5ba71c0cb764132b4f28'
    'Content-Type' = 'application/json'
}
$sql = "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'update_customer_profile'"
$json = '"' + $sql.Replace('"', '\"').Replace("`n", '\n').Replace("`r", '') + '"'
$body = '{"query": ' + $json + '}'
try {
    $response = Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query' -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    "Error: " + $_.Exception.Message
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $reader.ReadToEnd()
    }
}