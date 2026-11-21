-- pg_net starts the HTTP request after commit, when the worker can claim the job.
create function public.wake_telegram_dispatch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  endpoint text;
  token text;
begin
  select max(decrypted_secret) filter (where name = 'telegram_dispatch_url'),
         max(decrypted_secret) filter (where name = 'telegram_dispatch_secret')
    into endpoint, token
    from vault.decrypted_secrets where name in ('telegram_dispatch_url', 'telegram_dispatch_secret');
  if endpoint is not null and token is not null then
    perform net.http_post(url := endpoint, headers := jsonb_build_object('Authorization', 'Bearer ' || token),
      body := '{}'::jsonb, timeout_milliseconds := 55000);
  end if;
  return null;
exception when others then
  -- Keep the financial transaction and durable outbox intact for the scheduled worker.
  raise warning 'Telegram dispatch wake-up deferred to cron (SQLSTATE %)', sqlstate;
  return null;
end;
$$;
revoke all on function public.wake_telegram_dispatch() from public, anon, authenticated;

create trigger telegram_wake_on_enqueue after insert on public.telegram_outbox
for each row execute function public.wake_telegram_dispatch();
