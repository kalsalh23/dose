$headers = @{
    'Authorization' = 'Bearer sbp_v0_e3417023759a42de459b5ba71c0cb764132b4f28'
    'Content-Type' = 'application/json'
}
$sql = Get-Content 'C:\Users\DELL\Desktop\dose\test_simple.sql' -Raw
$body = '{"query": ' + ($sql | ConvertTo-Json) + '}'
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