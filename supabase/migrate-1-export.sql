-- ═══════════════════════════════════════════════
-- 1단계: 기존(뭄바이) 프로젝트에서 데이터 뽑아내기
-- ═══════════════════════════════════════════════
--
-- 이 파일을 "노래대기"(기존) 프로젝트의 SQL Editor 에서 실행하세요.
-- 결과로 INSERT 문들이 한 줄씩 나옵니다.
-- 그 결과를 전부 복사해서, 새 서울 프로젝트에 붙여넣고 실행하면 데이터가 옮겨집니다.
--
-- 비어 있는 테이블은 결과가 나오지 않습니다(정상입니다).
-- ═══════════════════════════════════════════════

-- 크루원
select 'insert into crew_members (id,name,active,member_type,role,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L)', id, name, active, member_type, role, created_at), E',\n  ')
  || ' on conflict (id) do nothing;' as sql
from crew_members
having count(*) > 0

union all

-- 비밀번호(해시 그대로 옮기므로 크루원은 쓰던 비밀번호를 계속 씁니다)
select 'insert into member_credentials (member_id,password_hash,must_change,updated_at) values '
  || string_agg(format('(%L,%L,%L,%L)', member_id, password_hash, must_change, updated_at), E',\n  ')
  || ' on conflict (member_id) do nothing;'
from member_credentials
having count(*) > 0

union all

-- 공지
select 'insert into announcements (id,title,body,url,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L)', id, title, body, url, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from announcements
having count(*) > 0

union all

-- 투표
select 'insert into votes (id,title,category,options,deadline,is_open,created_at) values '
  || string_agg(format('(%L,%L,%L,%L::jsonb,%L,%L,%L)', id, title, category, options, deadline, is_open, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from votes
having count(*) > 0

union all

select 'insert into vote_responses (id,vote_id,member_id,choice,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L)', id, vote_id, member_id, choice, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from vote_responses
having count(*) > 0

union all

-- 회비
select 'insert into dues_periods (id,label,amount,due_date,is_current,guest_dues_enabled,guest_amount,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L,%L,%L)', id, label, amount, due_date, is_current, guest_dues_enabled, guest_amount, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from dues_periods
having count(*) > 0

union all

select 'insert into dues_payments (id,period_id,member_id,paid,paid_at,claimed_at,visit_count,memo) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L,%L,%L)', id, period_id, member_id, paid, paid_at, claimed_at, visit_count, memo), E',\n  ')
  || ' on conflict (id) do nothing;'
from dues_payments
having count(*) > 0

union all

-- 미확인 체크
select 'insert into strikes (id,member_id,reason,vote_id,settled,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L)', id, member_id, reason, vote_id, settled, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from strikes
having count(*) > 0

union all

-- 규정
select 'insert into rule_categories (id,name,sort_order,created_at) values '
  || string_agg(format('(%L,%L,%L,%L)', id, name, sort_order, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from rule_categories
having count(*) > 0

union all

select 'insert into rules (id,category_id,title,body,version,requires_ack,is_published,sort_order,updated_at,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)', id, category_id, title, body, version, requires_ack, is_published, sort_order, updated_at, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from rules
having count(*) > 0

union all

select 'insert into rule_acks (id,rule_id,member_id,version,acked_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L)', id, rule_id, member_id, version, acked_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from rule_acks
having count(*) > 0

union all

select 'insert into rule_targets (rule_id,member_id) values '
  || string_agg(format('(%L,%L)', rule_id, member_id), E',\n  ')
  || ' on conflict do nothing;'
from rule_targets
having count(*) > 0

union all

-- 일정
select 'insert into events (id,title,starts_at,ends_at,place,memo,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L,%L)', id, title, starts_at, ends_at, place, memo, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from events
having count(*) > 0

union all

-- 요청
select 'insert into member_requests (id,type,name,birth_date,status,created_at) values '
  || string_agg(format('(%L,%L,%L,%L,%L,%L)', id, type, name, birth_date, status, created_at), E',\n  ')
  || ' on conflict (id) do nothing;'
from member_requests
having count(*) > 0

union all

-- 캐치마이크 대기열 (기존 부르기 대기열 앱과 공유)
select 'update nround_queue set state = ' || format('%L::jsonb', state) || ' where id = 1;'
from nround_queue
where id = 1;
