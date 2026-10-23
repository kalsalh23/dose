$headers = @{
    'Authorization' = 'Bearer sbp_v0_e3417023759a42de459b5ba71c0cb764132b4f28'
    'Content-Type' = 'application/json'
}
$sql = Get-Content 'C:\Users\DELL\Desktop\dose\test_simple.sql' -Raw
$json = $sql | ConvertTo-Json
$body = '{"query": ' + $json + '}'
$body