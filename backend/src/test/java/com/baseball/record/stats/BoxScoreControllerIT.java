package com.baseball.record.stats;

import com.baseball.record.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class BoxScoreControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token() throws Exception {
        String email = "box" + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }
    String createTeam(String t) throws Exception {
        return JsonPath.read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    /** away 客場 → top 半局我隊先攻；回 [gameId, firstPlayerId]。 */
    String[] liveGame(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        String firstPid = null; StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"P" + i + "\"}"))
                .andReturn().getResponse().getContentAsString(), "$.playerId");
            if (i == 0) firstPid = pid;
            if (i > 0) slots.append(",");
            slots.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
                 .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        mvc.perform(put("/api/games/" + gameId + "/roster").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"slots\":[" + slots + "]}")).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}")).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\",\"recordingDetail\":\"L2\"}")).andExpect(status().isOk());
        return new String[]{gameId, firstPid};
    }
    void postEvent(String t, String gameId, String json) throws Exception {
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isCreated());
    }

    @Test
    void box_score_reflects_event_stream() throws Exception { // AC-12
        String t = token(); String teamId = createTeam(t);
        String[] g = liveGame(t, teamId); String gameId = g[0]; String p1 = g[1];
        postEvent(t, gameId, "{\"eventType\":\"SINGLE\",\"actorPlayerId\":\"" + p1 + "\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"1\"}]}");

        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.team.hits").value(1))
           .andExpect(jsonPath("$.batting[?(@.playerId=='" + p1 + "')].h").value(org.hamcrest.Matchers.contains(1)));
    }

    @Test
    void er_override_takes_precedence_over_runs() throws Exception { // AC-12（ER 手動覆寫）
        String t = token(); String teamId = createTeam(t);
        String[] g = liveGame(t, teamId); String gameId = g[0]; String p1 = g[1];
        // 翻到守備半局：先攻 3 出局
        for (int i = 0; i < 3; i++)
            postEvent(t, gameId, "{\"eventType\":\"STRIKEOUT\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"OUT\"}]}");
        // 對手對我方投手 p1 擊出全壘打得 1 分（守備半局，actor=null）
        postEvent(t, gameId, "{\"eventType\":\"HOME_RUN\",\"guestBatterName\":\"敵\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"H\"}],\"pitches\":{\"pitches\":3,\"strikes\":2,\"balls\":1,\"swinging\":1,\"looking\":1}}");

        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].er").value(org.hamcrest.Matchers.contains(1)))     // 預設 = R
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].erOverridden").value(org.hamcrest.Matchers.contains(false)));
        // owner 手動把 ER 改成 0
        mvc.perform(put("/api/games/" + gameId + "/pitchers/" + p1 + "/er").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"er\":0}")).andExpect(status().isOk());
        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].er").value(org.hamcrest.Matchers.contains(0)))
           .andExpect(jsonPath("$.pitching[?(@.playerId=='" + p1 + "')].erOverridden").value(org.hamcrest.Matchers.contains(true)));
    }

    @Test
    void non_member_cannot_read_box_score() throws Exception {
        String a = token(); String teamId = createTeam(a);
        String gameId = liveGame(a, teamId)[0];
        String b = token();
        mvc.perform(get("/api/games/" + gameId + "/box-score").header("Authorization", "Bearer " + b))
           .andExpect(status().isNotFound());   // 非成員 → 404（沿 M2/M3a 隱藏存在性）
    }
}
