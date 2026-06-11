package com.baseball.record.scoring;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ScoringControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token(String p) throws Exception {
        String email = p + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }
    String createTeam(String t) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    /** 建賽（home 主場→ top 半局我隊先守；為讓首半局即我隊進攻，這裡用 away 客場）+ 9 人合法名單 + confirm + open live。回 gameId。 */
    String liveGame(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"P" + i + "\"}"))
                    .andReturn().getResponse().getContentAsString(), "$.playerId");
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
        return gameId;
    }

    /** 與 liveGame 相同，但 reEntryAllowed=false。 */
    String liveGameNoReEntry(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = com.jayway.jsonpath.JsonPath.read(
                mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"P" + i + "\"}"))
                    .andReturn().getResponse().getContentAsString(), "$.playerId");
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
        return gameId;
    }

    private String single() {
        return "{\"eventType\":\"SINGLE\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"1\"}]}";
    }
    private String strikeout() {
        return "{\"eventType\":\"STRIKEOUT\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"OUT\"}]}";
    }

    @Test
    void record_events_updates_state() throws Exception { // AC-8
        String t = token("s1_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(single())).andExpect(status().isCreated());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.state.outs").value(0))
           .andExpect(jsonPath("$.state.bases.first").isNotEmpty());
    }

    @Test
    void three_outs_flip_half() throws Exception { // AC-8
        String t = token("s2_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        for (int i = 0; i < 3; i++)
            mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(strikeout())).andExpect(status().isCreated());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.half").value("bottom"))
           .andExpect(jsonPath("$.state.battingSide").value("defense"))
           .andExpect(jsonPath("$.state.outs").value(0));
    }

    @Test
    void re_entry_when_not_allowed_is_422() throws Exception { // AC-9（建一場 reEntryAllowed=false）
        String t = token("s3_"); String teamId = createTeam(t);
        String gameId = liveGameNoReEntry(t, teamId);
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"eventType\":\"RE_ENTRY\",\"runnerMoves\":[]}"))
           .andExpect(status().isUnprocessableEntity())
           .andExpect(jsonPath("$.violations").isArray())
           .andExpect(jsonPath("$.violations").isNotEmpty());
    }

    @Test
    void correction_recomputes_state() throws Exception { // AC-11
        String t = token("s4_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        // 記 HOME_RUN（得 1 分），再改成 STRIKEOUT → 比分應回 0、後續快照重算
        String hrId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"eventType\":\"HOME_RUN\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"H\"}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.eventId");
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.scoreUs").value(1));
        mvc.perform(patch("/api/games/" + gameId + "/events/" + hrId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(strikeout())).andExpect(status().isOk());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.scoreUs").value(0))
           .andExpect(jsonPath("$.state.outs").value(1));
    }

    @Test
    void delete_event_recomputes() throws Exception { // AC-11（撤銷）
        String t = token("s5_"); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);
        String id = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(single()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.eventId");
        mvc.perform(delete("/api/games/" + gameId + "/events/" + id).header("Authorization", "Bearer " + t))
           .andExpect(status().isOk());
        mvc.perform(get("/api/games/" + gameId + "/state").header("Authorization", "Bearer " + t))
           .andExpect(jsonPath("$.state.bases.first").doesNotExist());
    }

    @Test
    void non_owner_cannot_record() throws Exception {
        String a = token("s6a_"); String teamId = createTeam(a);
        String gameId = liveGame(a, teamId);
        String b = token("s6b_");
        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + b)
                .contentType(MediaType.APPLICATION_JSON).content(single()))
           .andExpect(status().isNotFound()); // 非成員 → 404（隱藏存在性，沿 M2）
    }
}
