-- فحص استجابات pg_net
select id, status_code, error_msg, content::text
from net._http_response
order by id desc limit 3;
