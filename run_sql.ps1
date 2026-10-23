$body = Get-Content 'C:\Users\DELL\Desktop\dose\sql_query.json' -Raw
$response = Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/mqstsxuscqbxnyejhixk/database/query' -Headers @{'Authorization'='Bearer sbp_v0_e3417023759a42de459b5ba71c0cb764132b4f28'; 'Content-Type'='application/json'} -Body $body
$response | ConvertTo-Json -Depth 10