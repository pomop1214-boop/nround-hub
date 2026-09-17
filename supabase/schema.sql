-- ═══════════════════════════════════════════════
-- N.ROUND 통합 허브 스키마
-- Supabase → SQL Editor 에 전체를 붙여넣고 Run 하세요.
--
-- 캐치마이크 대기열(nround_queue)은 이미 있으면 그대로 두고,
-- 없을 때만 새로 만듭니다. 기존 부르기 대기열 앱과 같은 테이블이라
-- 두 앱이 같은 대기열을 실시간으로 공유합니다.
-- ═══════════════════════════════════════════════

-- ── 캐치마이크 대기열 ────────────────────────
-- 단일 행(id=1)에 전체 상태를 jsonb 로 담습니다.
create table if not exists nround_queue (
  id int primary key,
  state jsonb not null default '{"nowSinging":null,"waitlist":[],"history":[],"openAt":null}'::jsonb
);
insert into nround_queue (id) values (1) on conflict (id) do nothing;

alter table nround_queue enable row level security;
drop policy if exists "read" on nround_queue;
drop policy if exists "write" on nround_queue;
create policy "read"  on nround_queue for select using (true);
create policy "write" on nround_queue for update using (true) with check (true);

grant select, update on nround_queue to anon, authenticated;

-- 실시간 반영(이미 등록돼 있으면 에러가 나므로 무시하고 넘어갑니다)
do $$
begin
  alter publication supabase_realtime add table nround_queue;
exception when others then null;
end $$;

-- 오픈 예약을 서버 시간 기준으로 계산하기 위한 함수
create or replace function get_server_time()
returns timestamptz language sql stable as $$ select now() $$;
grant execute on function get_server_time() to anon, authenticated;

-- ── 공지 ────────────────────────────────────
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- ── 크루원 명단 (회비·투표·규정에서 공통으로 씁니다) ──
create table if not exists crew_members (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  -- 'member' = 회원(월 정액), 'guest' = 비회원(참여한 횟수만큼)
  member_type text not null default 'member',
  created_at timestamptz not null default now()
);

-- 비밀번호는 crew_members 가 아니라 이 테이블에 따로 보관합니다.
-- crew_members 는 앱에서 이름 목록을 읽어야 해서 공개 읽기가 열려 있는데,
-- 같은 테이블에 두면 비밀번호까지 함께 읽혀버리기 때문입니다.
create table if not exists member_credentials (
  member_id uuid primary key references crew_members (id) on delete cascade,
  password_hash text not null,      -- scrypt 해시. 원문은 저장하지 않습니다.
  must_change boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ── 투표 ────────────────────────────────────
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '기타',   -- 월 참여 | 주 참여 | 기타
  options jsonb not null default '[]',     -- (예전 구조) 보기 목록
  -- 질문 목록: [{id,label,type:'single'|'multi'|'text',options:[]}]
  questions jsonb,
  -- 비회원도 참여하는 투표인지
  include_guests boolean not null default true,
  deadline timestamptz,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists vote_responses (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid references votes (id) on delete cascade,
  member_id uuid references crew_members (id) on delete cascade,
  choice text,                             -- (예전 구조) 단일 선택
  answers jsonb,                           -- { 질문id: 문자열 | 문자열배열 }
  created_at timestamptz not null default now(),
  unique (vote_id, member_id)
);

-- ── 회비 ────────────────────────────────────
create table if not exists dues_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,             -- 예: "2026년 8월 회비"
  amount integer not null,         -- 회원 1인당 금액(원)
  due_date date,
  is_current boolean not null default true,
  -- 비회원에게 참여비를 받을지 여부(끄면 비회원은 회비 화면에서 제외됩니다)
  guest_dues_enabled boolean not null default false,
  guest_amount integer not null default 0,   -- 비회원 1회 참여비
  created_at timestamptz not null default now()
);

create table if not exists dues_payments (
  id uuid primary key default gen_random_uuid(),
  period_id uuid references dues_periods (id) on delete cascade,
  member_id uuid references crew_members (id) on delete cascade,
  paid boolean not null default false,
  paid_at timestamptz,
  claimed_at timestamptz,          -- 크루원이 "보냈어요"를 누른 시각
  visit_count integer not null default 0,  -- 비회원이 이번 회차에 참여한 횟수
  memo text,
  unique (period_id, member_id)
);

-- ── 기간내 미확인 체크 (누적 3회 → 벌금 5,000원) ──
create table if not exists strikes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references crew_members (id) on delete cascade,
  reason text not null,                    -- 예: "8월 정기모임 참석 투표 미응답"
  vote_id uuid references votes (id) on delete set null,
  settled boolean not null default false,  -- 벌금 정산이 끝난 건은 true
  created_at timestamptz not null default now(),
  -- 같은 투표로 같은 사람에게 두 번 기록되지 않게 막아둡니다.
  unique (member_id, vote_id)
);

-- ── 크루 규정 위키 + 동의 체크 ──────────────
create table if not exists rule_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references rule_categories (id) on delete set null,
  title text not null,
  body text not null default '',
  version integer not null default 1,      -- 재동의가 필요한 수정을 하면 1씩 올라갑니다
  requires_ack boolean not null default true,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists rule_acks (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references rules (id) on delete cascade,
  member_id uuid references crew_members (id) on delete cascade,
  version integer not null,                -- 동의한 시점의 버전
  acked_at timestamptz not null default now(),
  unique (rule_id, member_id, version)
);

-- 규정에 대상이 하나도 없으면 = 전체 공개.
-- 한 명이라도 지정되어 있으면 = 지정된 사람에게만 보입니다.
create table if not exists rule_targets (
  rule_id uuid references rules (id) on delete cascade,
  member_id uuid references crew_members (id) on delete cascade,
  primary key (rule_id, member_id)
);

-- ═══════════════════════════════════════════════
-- 접근 정책
-- 참여자는 로그인 없이 읽고 쓰되, 관리자 동작은 앱의 PIN 화면에서만 노출됩니다.
-- ═══════════════════════════════════════════════

alter table announcements enable row level security;
drop policy if exists "announcements access" on announcements;
create policy "announcements access" on announcements for select using (true);

-- 구독 정보는 서버(service_role)만 다룹니다. 정책을 만들지 않아 공개 키로는 접근 불가.
alter table push_subscriptions enable row level security;

alter table crew_members enable row level security;
drop policy if exists "crew_members access" on crew_members;
create policy "crew_members access" on crew_members for all using (true) with check (true);

-- 비밀번호는 정책을 하나도 만들지 않습니다.
-- RLS가 켜져 있고 정책이 없으면 공개 키로는 아무것도 읽거나 쓸 수 없고,
-- 서버(service_role)에서만 접근할 수 있습니다.
alter table member_credentials enable row level security;

alter table votes enable row level security;
drop policy if exists "votes access" on votes;
create policy "votes access" on votes for all using (true) with check (true);

alter table vote_responses enable row level security;
drop policy if exists "vote_responses access" on vote_responses;
create policy "vote_responses access" on vote_responses for all using (true) with check (true);

alter table dues_periods enable row level security;
drop policy if exists "dues_periods access" on dues_periods;
create policy "dues_periods access" on dues_periods for all using (true) with check (true);

alter table dues_payments enable row level security;
drop policy if exists "dues_payments access" on dues_payments;
create policy "dues_payments access" on dues_payments for all using (true) with check (true);

alter table strikes enable row level security;
drop policy if exists "strikes access" on strikes;
create policy "strikes access" on strikes for all using (true) with check (true);

alter table rule_categories enable row level security;
drop policy if exists "rule_categories access" on rule_categories;
create policy "rule_categories access" on rule_categories for all using (true) with check (true);

alter table rules enable row level security;
drop policy if exists "rules access" on rules;
create policy "rules access" on rules for all using (true) with check (true);

alter table rule_acks enable row level security;
drop policy if exists "rule_acks access" on rule_acks;
create policy "rule_acks access" on rule_acks for all using (true) with check (true);

alter table rule_targets enable row level security;
drop policy if exists "rule_targets access" on rule_targets;
create policy "rule_targets access" on rule_targets for all using (true) with check (true);

-- ─────────────────────────────────────────────
-- 일정 (공지용 · 참석 응답 없음)
-- ─────────────────────────────────────────────

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  place text,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists events_starts_at_idx on events (starts_at);

alter table events enable row level security;
drop policy if exists "events access" on events;
create policy "events access" on events for all using (true) with check (true);

-- ─────────────────────────────────────────────
-- 운영진 임명
-- ─────────────────────────────────────────────
-- null = 일반 크루원, 'sub_lead' = 부운영장, 'supporter' = 서포터즈
alter table crew_members
  add column if not exists role text;

-- ─────────────────────────────────────────────
-- 가입 / 비밀번호 재발급 요청
-- ─────────────────────────────────────────────

-- type: 'join' = 가입 요청, 'reset' = 비밀번호 재발급 요청
-- status: 'pending' | 'done'
create table if not exists member_requests (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  birth_date text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists member_requests_status_idx on member_requests (status, created_at desc);

-- 요청은 로그인 전에도 보낼 수 있어야 해서 서버(service_role)에서만 다룹니다.
alter table member_requests enable row level security;

-- 알림을 어느 크루원의 기기인지 알 수 있게 연결합니다(운영장에게만 보내기 위함).
alter table push_subscriptions
  add column if not exists member_id uuid references crew_members (id) on delete set null;

-- 공지를 어디까지 읽었는지 (기기가 바뀌어도 유지되도록 서버에 둡니다)
alter table crew_members
  add column if not exists notices_seen_at timestamptz;
