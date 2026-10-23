$headers = @{
    'Authorization' = 'Bearer sbp_v0_e3417023759a42de459b5ba71c0cb764132b4f28'
    'Content-Type' = 'application/json'
}
$body = '{"query": "create or replace function public.update_customer_profile(p_token uuid, p_full_name text) returns jsonb language plpgsql security definer set search_path = public as $$ declare c public.customers; begin if length(btrim(p_full_name)) < 2 then raise exception '\''invalid_name'\''; end if; select c.* into c from public.customers c join public.customer_sessions s on s.customer_id = c.id where s.token = p_token; if c is null then raise exception '\''unauthorized'\''; end if; update public.customers set full_name = btrim(p_full_name) where id = c.id; return jsonb_build_object('\''full_name'\'', btrim(p_full_name)); end $$; SELECT 1"}'
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