# 資料模型：棒壘球紀錄平台

## 1. UserAccount

**說明**：平台登入主體。  
**主要欄位**：
- `userId`
- `displayName`
- `emailOrLoginId`
- `accountStatus`
- `joinedTeams[]`
- `personalCalendarEntries[]`
- `notificationInbox[]`

**驗證**：
- 帳號必須可對應至少一個角色或可建立新球隊。
- 同一帳號可跨球隊擁有不同角色。
- 並非每位球員都必須先有 UserAccount。

## 2. Team

**說明**：球隊主體。  
**主要欄位**：
- `teamId`
- `teamName`
- `sportType`
- `teamStatus`
- `owners[]`
- `members[]`
- `players[]`
- `calendarViews[]`

**關聯**：
- 一個 Team 對多個 TeamMembership、PlayerProfile、Game、TeamCalendarEntry。

## 3. TeamMembership

**說明**：使用者與球隊的角色關係。  
**主要欄位**：
- `membershipId`
- `teamId`
- `userId`
- `roles[]`
- `membershipStatus`

**驗證**：
- 角色可多選，例如 `player` 與 `scorer` 同時存在。
- 權限顯示需以角色集合判定，而非單一角色覆蓋。
- 球員資料不一定需要先建立 TeamMembership 或 UserAccount。

## 4. PlayerProfile

**說明**：球隊中的球員資料。  
**主要欄位**：
- `playerId`
- `teamId`
- `displayName`
- `uniformNumber`
- `linkedUserId?`
- `linkedMembershipId?`
- `accountLinkStatus`
- `primaryPositions[]`
- `secondaryPositions[]`
- `rosterStatus`
- `historyRecords[]`

**驗證**：
- 在隊狀態與可出賽狀態必須區分。
- 球員可在未綁定帳號時先建立並加入球隊名單。
- 後續補綁帳號時不得破壞既有球員歷史、出賽與統計關聯。
- 歷史紀錄不可覆寫，只能新增節點。

## 5. Game

**說明**：單場比賽主體。  
**主要欄位**：
- `gameId`
- `teamId`
- `sportType`
- `matchMode`
- `competitionCategory`
- `rulePresetId`
- `gameDate`
- `venue`
- `opponentName`
- `homeAway`
- `visibilityMode`
- `shareTierMode`
- `gameStatus`
- `gameResolution`
- `standingsInclusionMode`
- `checkInDeadline?`
- `notificationPolicyId?`

**狀態轉換**：
- `draft -> scheduled -> lineup_confirmed -> live -> paused -> completed -> reviewed -> shared`

**驗證**：
- `competitionCategory` 應能標示為 `cup`、`league` 或 `friendly`。
- `gameResolution` 應獨立於流程狀態存在，可標示為 `win`、`loss`、`draw`、`postponed`、`forfeit_loss`、`opponent_forfeit`、`regulatory_loss`、`regulatory_win`。
- `standingsInclusionMode` 應可表達納入、不納入或依管理決策處理。

## 6. TeamCalendarEntry

**說明**：球隊視角的賽程行事曆項目。  
**主要欄位**：
- `calendarEntryId`
- `teamId`
- `gameId`
- `entryDate`
- `entryStatus`
- `responseSummary`
- `notificationState`

**驗證**：
- 同一場比賽在球隊行事曆僅應存在一個有效主項目。
- 顯示的報名摘要必須與最新回覆狀態一致。

## 7. PersonalCalendarEntry

**說明**：個人視角的賽程與出賽回覆項目。  
**主要欄位**：
- `personalEntryId`
- `userId`
- `teamId`
- `gameId`
- `entryDate`
- `responseStatus`
- `respondedAt?`
- `notificationReadState`

**驗證**：
- 僅當使用者具備該球隊或比賽檢視權限時才可見。
- 同一使用者對同一場比賽只能保留一個最新有效回覆狀態。

## 8. AttendanceResponse

**說明**：成員對單場比賽的出賽回覆紀錄。  
**主要欄位**：
- `responseId`
- `gameId`
- `teamId`
- `userId`
- `responseStatus`
- `responseSource`
- `respondedAt`
- `notes?`

**驗證**：
- `responseStatus` 僅允許 `attending`、`declined`、`tentative`、`unanswered`。
- 本階段 `responseSource` 僅允許平台內部通道，外部通道保留為未來擴充。

## 9. NotificationTask

**說明**：比賽建立、異動或報名提醒所產生的通知任務。  
**主要欄位**：
- `notificationId`
- `gameId`
- `teamId`
- `notificationType`
- `targetScope`
- `deliveryChannel`
- `deliveryStatus`

**驗證**：
- 本階段 `deliveryChannel` 以平台內通知為主。
- LINE 或其他外部通道僅可作為未來擴充標記，不得成為 MVP 必要條件。

## 10. RulePreset

**說明**：平台預設規則模板。  
**主要欄位**：
- `rulePresetId`
- `sportType`
- `matchMode`
- `supportsReEntry`
- `supportsDH`
- `supportsEP`
- `friendlyRosterFlexEnabled`

**驗證**：
- 球隊僅能切換 `sportType` 與 `matchMode`。
- 其他核心規則欄位不得由球隊任意變更。

## 11. GameRoster

**說明**：比賽出賽名單。  
**主要欄位**：
- `gameRosterId`
- `gameId`
- `startingLineup[]`
- `benchPlayers[]`
- `activeParticipants[]`
- `pendingScorerRequests[]`

**驗證**：
- 正式賽模式需依規則集驗證先發配置。
- 友誼賽模式允許 activeParticipants 動態增減。

## 12. LineupSlot

**說明**：打序與守位配置。  
**主要欄位**：
- `slotNo`
- `playerId`
- `battingOrder`
- `fieldPosition`
- `lineupStatus`

## 13. TemporaryScorerRequest

**說明**：該場次臨時紀錄權限申請。  
**主要欄位**：
- `requestId`
- `gameId`
- `requesterUserId`
- `requestStatus`
- `approvedBy`
- `approvedAt`

**驗證**：
- `approvedBy` 只能是球隊擁有者、球隊管理者或教練。
- 未核准前不得寫入賽事事件。

## 14. GameEvent

**說明**：賽事事件時間線中的單筆事件。  
**主要欄位**：
- `eventId`
- `gameId`
- `inning`
- `half`
- `sequenceNo`
- `eventType`
- `actorPlayerId`
- `relatedPlayers[]`
- `scoreDelta`
- `outsAfter`
- `basesAfter`
- `snapshotAfter`
- `captureSource`

**驗證**：
- 每筆事件都必須能推導比數、出局、壘包與場上人員。
- `captureSource` 可標示為手動、掃描輔助或語音輔助，以保留後續擴充辨識。
- 修正事件後必須允許重新推導後續快照。

## 15. GameStatLine

**說明**：單場統計輸出。  
**主要欄位**：
- `gameId`
- `playerStats[]`
- `teamStats`
- `derivedAt`

## 16. CumulativeStatView

**說明**：跨條件查詢的累積統計與戰績結果。  
**主要欄位**：
- `filterSet`
- `includedCompetitionCategories[]`
- `mergeMode`
- `reportPreset`
- `periodStart`
- `periodEnd`
- `playerStatRows[]`
- `teamStatRows[]`
- `teamRecordRows[]`
- `generatedAt`

**驗證**：
- `mergeMode` 應可表達分開、全部合併或部分合併。
- `reportPreset` 應支援 `quarterly_3_months`、`yearly_12_months` 與 `custom_range`。
- 戰績與成績需共用相同的分類與區間條件來源。

## 17. SharePolicy

**說明**：公開分享政策。  
**主要欄位**：
- `visibilityMode`
- `shareTierMode`
- `allowedFields[]`

**驗證**：
- 只能套用平台預定義的 A/B/C 層級。
- 非公開時不得輸出任何公開內容。

## 關係總覽

- `UserAccount` 1..* `TeamMembership`
- `UserAccount` 1..* `PersonalCalendarEntry`
- `Team` 1..* `TeamMembership`
- `Team` 1..* `PlayerProfile`
- `Team` 1..* `TeamCalendarEntry`
- `PlayerProfile` 0..1 `UserAccount`（optional link）
- `PlayerProfile` 0..1 `TeamMembership`（optional link）
- `Team` 1..* `Game`
- `Game` 1..1 `RulePreset`
- `Game` 1..1 `GameRoster`
- `GameRoster` 1..* `LineupSlot`
- `Game` 1..* `AttendanceResponse`
- `Game` 1..* `NotificationTask`
- `Game` 1..* `GameEvent`
- `Game` 1..1 `GameStatLine`
- `Game` 1..* `TemporaryScorerRequest`
- `Game` 1..1 `SharePolicy`

## 需要在 UI 中明示的狀態

- 球員：在隊、替補待命、先發中、已上場、暫時退場、可再上場、不可再上場
- 比賽：草稿、已排程、名單已確認、進行中、暫停、已結束、已回顧、已分享
- 比賽結果：勝、負、和、延賽、棄賽、對手棄權、違規判負、違規判勝、納入戰績、不納入戰績
- 臨時紀錄權限：待審核、已核准、已拒絕、已失效
- 報名回覆：參加、不參加、待定、未回覆
- 通知：未讀、已讀、待發送、已送達、外部通道保留
- 記錄來源：手動、掃描輔助、語音輔助
