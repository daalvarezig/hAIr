
create extension if not exists pgcrypto;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null unique,
  base_duration_short integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  service_id uuid not null references services(id),
  hair_length text not null check (hair_length in ('short','medium','long')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'booked' check (status in ('booked','confirmed','cancelled','completed','no_show')),
  source text not null default 'dashboard',
  notes text,
  created_at timestamptz not null default now()
);

insert into services (category, name, base_duration_short) values
('styling', 'peinar', 25),
('cut', 'cortar_y_peinar', 40),
('color', 'tinte', 40),
('color', 'barros', 40),
('color', 'mechas', 60),
('color', 'rayos_de_sol', 60)
on conflict (name) do nothing;

create or replace function calculate_service_duration(
  p_service_id uuid,
  p_hair_length text
)
returns integer
language plpgsql
as $$
declare
  v_base integer;
begin
  select base_duration_short into v_base
  from services
  where id = p_service_id and active = true;

  if v_base is null then
    raise exception 'Service not found';
  end if;

  if p_hair_length = 'short' then
    return v_base;
  elsif p_hair_length = 'medium' then
    return v_base + 15;
  elsif p_hair_length = 'long' then
    return v_base + 30;
  else
    raise exception 'Invalid hair length';
  end if;
end;
$$;

create or replace function create_appointment(
  p_client_id uuid,
  p_service_id uuid,
  p_hair_length text,
  p_starts_at timestamptz,
  p_notes text default null
)
returns appointments
language plpgsql
as $$
declare
  v_duration integer;
  v_ends_at timestamptz;
  v_conflict uuid;
  v_row appointments;
begin
  v_duration := calculate_service_duration(p_service_id, p_hair_length);
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  if (p_starts_at::time < time '10:00') or (v_ends_at::time > time '19:00') then
    raise exception 'Appointment outside business hours';
  end if;

  select id into v_conflict
  from appointments
  where status in ('booked','confirmed')
    and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, v_ends_at, '[)')
  limit 1;

  if v_conflict is not null then
    raise exception 'Time slot not available';
  end if;

  insert into appointments (
    client_id, service_id, hair_length, starts_at, ends_at, notes
  ) values (
    p_client_id, p_service_id, p_hair_length, p_starts_at, v_ends_at, p_notes
  ) returning * into v_row;

  return v_row;
end;
$$;

create or replace view appointments_with_details as
select
  a.id,
  a.starts_at,
  a.ends_at,
  a.status,
  a.source,
  a.hair_length,
  a.notes,
  c.full_name as client_name,
  c.phone,
  s.category,
  s.name as service_name
from appointments a
join clients c on c.id = a.client_id
join services s on s.id = a.service_id
order by a.starts_at asc;
