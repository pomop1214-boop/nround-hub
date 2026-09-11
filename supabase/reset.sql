-- ═══════════════════════════════════════════════
-- N.ROUND 허브 — 초기화
-- ═══════════════════════════════════════════════
--
-- 허브가 만든 테이블만 지웁니다.
-- 공지·투표·회비·규정·동의 기록·크루원 명단·비밀번호가 사라집니다.
--
-- 이 프로젝트에는 다른 앱도 함께 살고 있어서, 아래 것들은 건드리지 않습니다.
--   nround_queue                              → 캐치마이크 대기열
--   busking_submissions, busking_config       → 버스킹 곡신청 앱
--   saturday_poll_config, saturday_poll_responses → 토요일 RSVP 앱
--
-- 실행 순서
--   1) 이 파일(reset.sql) 전체를 붙여넣고 Run
--   2) 이어서 schema.sql 전체를 붙여넣고 Run
--
-- ⚠️ 알림 구독도 초기화됩니다.
--    크루원들이 각자 홈 화면에서 "공지 알림 켜기"를 다시 눌러야 해요.
-- ═══════════════════════════════════════════════

drop table if exists rule_targets cascade;
drop table if exists rule_acks cascade;
drop table if exists rules cascade;
drop table if exists rule_categories cascade;

drop table if exists member_requests cascade;
drop table if exists events cascade;


drop table if exists strikes cascade;

drop table if exists dues_payments cascade;
drop table if exists dues_periods cascade;

drop table if exists vote_responses cascade;
drop table if exists votes cascade;

drop table if exists member_credentials cascade;
drop table if exists crew_members cascade;

drop table if exists push_subscriptions cascade;
drop table if exists announcements cascade;

-- 예전 버전에서 잠깐 만들었던 설문 테이블이 남아 있다면 함께 정리합니다.
drop table if exists survey_responses cascade;
drop table if exists surveys cascade;
