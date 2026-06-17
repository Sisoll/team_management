-- 手動測試用：把本機 dev DB 重置為「乾淨的已知狀態」+ 種子資料。
-- ⚠️ 會清空所有 使用者/隊伍/球員/比賽/名單/事件 資料（保留 schema、flyway 紀錄、rule_preset 參考資料）。
--    只對本機 compose 的 baseball DB 用；勿對正式環境執行。
--
-- 跑法：
--   podman exec -i backend_db_1 psql -U baseball -d baseball < backend/scripts/seed-manual.sql
--
-- 跑完登入：owner@demo.com / demo123（OWNER 角色），隊伍「Demo Squad」+ 12 名球員、守位齊全。
-- 之後比賽/報名/名單請在 UI 自行建立（種子只給帳號+隊+球員，保持精簡）。

BEGIN;

-- 1) 清空所有業務資料（rule_preset 是 migration 灌入的參考資料、flyway_schema_history 是版控紀錄，皆保留）
TRUNCATE TABLE
    er_override, game_event, game_signup, lineup_slot, game_roster, games,
    player_history, players, team_memberships, teams, users
  RESTART IDENTITY CASCADE;

-- 2) demo 使用者（password_hash = 密碼 demo123 的 BCrypt；可直接登入）
INSERT INTO users (user_id, display_name, email, password_hash, account_status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Demo Owner', 'owner@demo.com',
   '$2a$10$z7w6QhdQvrPCCfafkSosmerR1WjITOdgi8XbNgBhzP.ltNJARGr9G', 'active');

-- 3) 隊伍 + 建立者 owner 身分
INSERT INTO teams (team_id, team_name, sport_type, created_by) VALUES
  ('22222222-2222-2222-2222-222222222222', 'Demo Squad', 'baseball',
   '11111111-1111-1111-1111-111111111111');

INSERT INTO team_memberships (membership_id, team_id, user_id, roles) VALUES
  ('33333333-3333-3333-3333-333333333333',
   '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', ARRAY['owner']);

-- 4) 12 名球員（守位齊全；player_id 每次重跑重新產生）
INSERT INTO players (player_id, team_id, display_name, uniform_number, primary_positions) VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Wang',  '1',  ARRAY['SP']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Lin',   '2',  ARRAY['C']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Chen',  '3',  ARRAY['1B']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Huang', '4',  ARRAY['2B']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Lee',   '5',  ARRAY['3B']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Wu',    '6',  ARRAY['SS']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Tsai',  '7',  ARRAY['LF']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Chang', '8',  ARRAY['CF']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Yang',  '9',  ARRAY['RF']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Chou',  '10', ARRAY['SS','2B']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Hsu',   '11', ARRAY['2B','LF']),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Kuo',   '12', ARRAY['RP','1B']);

COMMIT;
