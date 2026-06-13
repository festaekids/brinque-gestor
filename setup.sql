-- ============================================================
-- BRINCAGESTOR - Script de criação das tabelas
-- Cole este script no SQL Editor do Supabase e clique em "Run"
-- ============================================================

-- Tabela de brinquedos
create table if not exists toys (
  id text primary key,
  name text not null,
  size text,
  quantity integer default 0,
  price numeric,
  image text,
  created_at timestamptz default now()
);

-- Tabela de clientes
create table if not exists clients (
  id text primary key,
  name text not null,
  address text,
  whatsapp text,
  document text,
  created_at timestamptz default now()
);

-- Tabela de reservas
create table if not exists reservations (
  id text primary key,
  client_id text references clients(id) on delete set null,
  address text,
  start_date date not null,
  start_time text,
  end_date date,
  end_time text,
  items jsonb default '[]',
  total numeric default 0,
  deposit numeric default 0,
  notes text,
  status text default 'pendente',
  created_at timestamptz default now()
);

-- Tabela financeira (receitas e despesas)
create table if not exists finance (
  id text primary key,
  type text not null check (type in ('receita','despesa')),
  description text not null,
  amount numeric not null,
  date date not null,
  reservation_id text references reservations(id) on delete set null,
  created_at timestamptz default now()
);

-- Tabela da empresa (sempre terá 1 única linha, id fixo = 1)
create table if not exists company (
  id integer primary key default 1,
  name text default '',
  cnpj text default '',
  phone text default '',
  email text default '',
  address text default '',
  logo text default ''
);

-- Garante que exista a linha única da empresa
insert into company (id) values (1)
on conflict (id) do nothing;

-- ============================================================
-- SEGURANÇA: habilita acesso via chave anônima (anon)
-- Como o app terá login próprio por senha (não pelo Supabase Auth),
-- liberamos leitura/escrita pública nas tabelas via Row Level Security
-- com policies abertas. Quem acessa o app já passou pela tela de senha.
-- ============================================================

alter table toys enable row level security;
alter table clients enable row level security;
alter table reservations enable row level security;
alter table finance enable row level security;
alter table company enable row level security;

create policy "allow all toys" on toys for all using (true) with check (true);
create policy "allow all clients" on clients for all using (true) with check (true);
create policy "allow all reservations" on reservations for all using (true) with check (true);
create policy "allow all finance" on finance for all using (true) with check (true);
create policy "allow all company" on company for all using (true) with check (true);

-- ============================================================
-- DADOS DE EXEMPLO (opcional - pode apagar depois)
-- ============================================================

insert into toys (id, name, size, quantity, price) values
  ('t1', 'Cama Elástica', '3,05m', 1, 250),
  ('t2', 'Tobogã Grande', '5x3m', 2, 350),
  ('t3', 'Piscina de Bolinhas', '2x2m', 1, 180)
on conflict (id) do nothing;

insert into clients (id, name, address, whatsapp, document, created_at) values
  ('c1', 'Gabriel Souza', 'Rua Teste, 123', '(47) 98837-5841', '', '2025-09-12')
on conflict (id) do nothing;

insert into reservations (id, client_id, address, start_date, start_time, end_date, end_time, items, total, deposit, notes, status) values
  ('r1', 'c1', 'Rua Teste, 123', '2025-09-12', '10:00', '2025-09-12', '14:00',
   '[{"toyId":"t1","quantity":1},{"toyId":"t2","quantity":1}]', 800, 400, '', 'confirmado')
on conflict (id) do nothing;

insert into finance (id, type, description, amount, date, reservation_id) values
  ('auto-deposit-r1', 'receita', 'Sinal recebido - Gabriel Souza', 400, '2025-09-12', 'r1')
on conflict (id) do nothing;
