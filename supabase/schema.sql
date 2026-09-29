-- ============================================================
-- ProposalFlow Supabase Database Schema & Row-Level Security
-- ============================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  upi_id text not null default '',
  phone text default '',
  logo_url text default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Migration for existing databases
alter table public.profiles add column if not exists logo_url text default '';


-- 2. CLIENTS TABLE
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text default '',
  created_at timestamptz default now() not null
);

-- 3. PROPOSALS TABLE
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  line_items jsonb not null default '[]'::jsonb,
  milestones jsonb not null default '[]'::jsonb,
  total_amount numeric(12, 2) not null default 0.00,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved')),
  approved_at timestamptz,
  approved_ip text,
  created_at timestamptz default now() not null
);

-- 4. INVOICES TABLE
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  milestone_label text not null,
  amount numeric(12, 2) not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'overdue')),
  due_date date not null default (current_date + 7),
  paid_at timestamptz,
  created_at timestamptz default now() not null
);

-- ------------------------------------------------------------
-- INDEXES FOR PERFORMANCE
-- ------------------------------------------------------------
create index if not exists idx_clients_user_id on public.clients(user_id);
create index if not exists idx_proposals_user_id on public.proposals(user_id);
create index if not exists idx_proposals_client_id on public.proposals(client_id);
create index if not exists idx_invoices_proposal_id on public.invoices(proposal_id);
create index if not exists idx_invoices_status on public.invoices(status);

-- ------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.proposals enable row level security;
alter table public.invoices enable row level security;

-- PROFILES POLICIES
-- Freelancer can view/manage their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Public can read profile business_name and upi_id for published proposals/invoices
create policy "Public can view business profiles of sent/approved proposals"
  on public.profiles for select
  using (
    id in (
      select user_id from public.proposals where status in ('sent', 'approved')
    )
  );

-- CLIENTS POLICIES
-- Only the owner can view/manage their clients
create policy "Users can view own clients"
  on public.clients for select
  using (auth.uid() = user_id);

create policy "Users can insert own clients"
  on public.clients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own clients"
  on public.clients for update
  using (auth.uid() = user_id);

create policy "Users can delete own clients"
  on public.clients for delete
  using (auth.uid() = user_id);

-- Public can view client info strictly if attached to a sent or approved proposal
create policy "Public can view client details on sent proposals"
  on public.clients for select
  using (
    id in (
      select client_id from public.proposals where status in ('sent', 'approved')
    )
  );

-- PROPOSALS POLICIES
-- Freelancers can manage all their proposals
create policy "Users can view own proposals"
  on public.proposals for select
  using (auth.uid() = user_id);

create policy "Users can insert own proposals"
  on public.proposals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own proposals"
  on public.proposals for update
  using (auth.uid() = user_id);

create policy "Users can delete own proposals"
  on public.proposals for delete
  using (auth.uid() = user_id);

-- Public can read proposals that have been sent or approved
create policy "Public can view sent or approved proposals"
  on public.proposals for select
  using (status in ('sent', 'approved'));

-- INVOICES POLICIES
-- Freelancers can manage their own invoices (via proposal ownership)
create policy "Users can view own invoices"
  on public.invoices for select
  using (
    exists (
      select 1 from public.proposals
      where public.proposals.id = public.invoices.proposal_id
      and public.proposals.user_id = auth.uid()
    )
  );

create policy "Users can update own invoices"
  on public.invoices for update
  using (
    exists (
      select 1 from public.proposals
      where public.proposals.id = public.invoices.proposal_id
      and public.proposals.user_id = auth.uid()
    )
  );

-- Public can view invoices
create policy "Public can view invoices"
  on public.invoices for select
  using (true);

-- ------------------------------------------------------------
-- AUTOMATIC PROFILE TRIGGER ON SIGNUP
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, business_name, upi_id, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', ''),
    coalesce(new.raw_user_meta_data->>'upi_id', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- SECURE PROPOSAL ACCEPTANCE RPC FUNCTION
-- Client one-tap accept: records IP + timestamp & creates invoices
-- ------------------------------------------------------------
create or replace function public.approve_proposal(
  p_proposal_id uuid,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_proposal record;
  v_milestone jsonb;
  v_invoice_ids uuid[] := array[]::uuid[];
  v_new_inv_id uuid;
  v_milestone_count int := 0;
  v_label text;
  v_amount numeric(12,2);
  v_due date;
begin
  -- Fetch the proposal
  select * into v_proposal
  from public.proposals
  where id = p_proposal_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Proposal not found');
  end if;

  -- If already approved, return existing status and invoice IDs
  if v_proposal.status = 'approved' then
    select array_agg(id) into v_invoice_ids
    from public.invoices
    where proposal_id = p_proposal_id;

    return jsonb_build_object(
      'success', true,
      'already_approved', true,
      'proposal_id', p_proposal_id,
      'invoice_ids', coalesce(v_invoice_ids, array[]::uuid[])
    );
  end if;

  -- Update proposal status
  update public.proposals
  set
    status = 'approved',
    approved_at = coalesce(approved_at, now()),
    approved_ip = coalesce(approved_ip, p_ip)
  where id = p_proposal_id;

  -- Check milestones jsonb
  if v_proposal.milestones is not null and jsonb_typeof(v_proposal.milestones) = 'array' then
    v_milestone_count := jsonb_array_length(v_proposal.milestones);
  end if;

  if v_milestone_count > 0 then
    -- Generate invoice per milestone
    for v_milestone in select * from jsonb_array_elements(v_proposal.milestones)
    loop
      v_label := coalesce(v_milestone->>'label', 'Milestone');
      v_amount := coalesce((v_milestone->>'amount')::numeric, 0.00);
      
      if v_milestone->>'due_date' is not null and (v_milestone->>'due_date') <> '' then
        v_due := (v_milestone->>'due_date')::date;
      else
        v_due := (current_date + 7);
      end if;

      insert into public.invoices (proposal_id, milestone_label, amount, due_date, status)
      values (p_proposal_id, v_label, v_amount, v_due, 'unpaid')
      returning id into v_new_inv_id;

      v_invoice_ids := array_append(v_invoice_ids, v_new_inv_id);
    end loop;
  else
    -- Single invoice for total amount
    insert into public.invoices (proposal_id, milestone_label, amount, due_date, status)
    values (p_proposal_id, 'Full Payment', v_proposal.total_amount, (current_date + 7), 'unpaid')
    returning id into v_new_inv_id;

    v_invoice_ids := array_append(v_invoice_ids, v_new_inv_id);
  end if;

  return jsonb_build_object(
    'success', true,
    'already_approved', false,
    'proposal_id', p_proposal_id,
    'invoice_ids', v_invoice_ids
  );
end;
$$;
