package com.baseball.record.game;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GameControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token(String p) throws Exception {
        String email = p + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }
    String createTeam(String token, String sport) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"T\",\"sportType\":\"" + sport + "\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");
    }
    String createGameBody(String opponent) {
        return "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
             + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,"
             + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"home\",\"opponentName\":\"" + opponent + "\"}";
    }

    @Test
    void create_game_enters_scheduled() throws Exception {
        String t = token("g1_"); String teamId = createTeam(t, "baseball");
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Lions")))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.gameId").isNotEmpty())
           .andExpect(jsonPath("$.gameStatus").value("scheduled"))
           .andExpect(jsonPath("$.opponentName").value("Lions"));
    }

    @Test
    void list_and_filter_by_status() throws Exception {
        String t = token("g2_"); String teamId = createTeam(t, "baseball");
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(createGameBody("A"))).andExpect(status().isCreated());
        mvc.perform(get("/api/teams/" + teamId + "/games?status=scheduled").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void intra_squad_allows_empty_opponent() throws Exception {
        String t = token("g3_"); String teamId = createTeam(t, "baseball");
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"intra_squad\",\"dhEnabled\":false,"
            + "\"epAllowed\":true,\"rosterSize\":9,\"reEntryAllowed\":true,\"gameDate\":\"2026-07-02\",\"homeAway\":\"home\"}";
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isCreated());
    }

    @Test
    void formal_requires_opponent() throws Exception {
        String t = token("g4_"); String teamId = createTeam(t, "baseball");
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"dhEnabled\":false,"
            + "\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,\"gameDate\":\"2026-07-03\",\"homeAway\":\"home\"}";
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test
    void non_member_cannot_get_game() throws Exception {
        String a = token("g5a_"); String teamId = createTeam(a, "baseball");
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + a)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("X")))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        String b = token("g5b_");
        mvc.perform(get("/api/games/" + gameId).header("Authorization", "Bearer " + b))
           .andExpect(status().isNotFound());
    }

    @Test
    void opponent_autocomplete() throws Exception {
        String t = token("g6_"); String teamId = createTeam(t, "baseball");
        mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Dragons"))).andExpect(status().isCreated());
        mvc.perform(get("/api/teams/" + teamId + "/opponents?q=dra").header("Authorization", "Bearer " + t))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[0].name").value("Dragons"));
    }

    /** 建賽 → 加 9 名球員 → PUT 合法名單 → confirm，回 gameId（lineup_confirmed）。 */
    private String createConfirmedGame(String t, String teamId) throws Exception {
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Foe")))
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
                .contentType(MediaType.APPLICATION_JSON).content("{\"slots\":[" + slots + "]}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isOk());
        return gameId;
    }

    @Test
    void open_pause_complete_flow() throws Exception {
        String t = token("gs_"); String teamId = createTeam(t, "baseball");
        String gameId = createConfirmedGame(t, teamId);

        // lineup_confirmed → live（帶開賽設定）
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"gameStatus\":\"live\",\"recordingDetail\":\"L2\",\"symmetricOpponent\":false}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.gameStatus").value("live"))
           .andExpect(jsonPath("$.recordingDetail").value("L2"));

        // live → paused → live → completed
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"paused\"}"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.gameStatus").value("paused"));
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\"}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"completed\"}"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.gameStatus").value("completed"));
    }

    @Test
    void illegal_transition_scheduled_to_live_conflicts() throws Exception {
        String t = token("gx_"); String teamId = createTeam(t, "baseball");
        String gameId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                    .contentType(MediaType.APPLICATION_JSON).content(createGameBody("Foe")))
                .andReturn().getResponse().getContentAsString(), "$.gameId");
        // scheduled → live（未經 lineup_confirmed）→ 409
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"live\"}"))
           .andExpect(status().isConflict());
    }
}
