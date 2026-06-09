package com.baseball.record.lineup;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class LineupControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    record Ctx(String token, String teamId, String gameId) {}

    String read(String json, String path) { return com.jayway.jsonpath.JsonPath.read(json, path).toString(); }

    String token(String p) throws Exception {
        String email = p + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return read(body, "$.token");
    }
    String addPlayer(String token, String teamId, String name, String pos) throws Exception {
        String body = "{\"displayName\":\"" + name + "\",\"primaryPositions\":[\"" + pos + "\"]}";
        String res = mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn().getResponse().getContentAsString();
        return read(res, "$.playerId");
    }
    Ctx baseballGame(String prefix) throws Exception {
        String t = token(prefix);
        String teamId = read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":false,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"home\",\"opponentName\":\"Lions\"}";
        String gameId = read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andReturn().getResponse().getContentAsString(), "$.gameId");
        return new Ctx(t, teamId, gameId);
    }
    String legalNineRoster(String token, String teamId) throws Exception {
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder sb = new StringBuilder("{\"slots\":[");
        for (int i = 0; i < 9; i++) {
            String pid = addPlayer(token, teamId, "P" + i, pos[i]);
            if (i > 0) sb.append(",");
            sb.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
              .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        return sb.append("]}").toString();
    }

    @Test
    void put_draft_roster_does_not_validate() throws Exception {
        Ctx c = baseballGame("l1_");
        String pid = addPlayer(c.token(), c.teamId(), "Solo", "P");
        String body = "{\"slots\":[{\"playerId\":\"" + pid + "\",\"battingOrder\":1,"
            + "\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.slots.length()").value(1));
    }

    @Test
    void validate_legal_lineup_is_valid() throws Exception {
        Ctx c = baseballGame("l2_");
        String body = legalNineRoster(c.token(), c.teamId());
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(post("/api/games/" + c.gameId() + "/roster:validate").header("Authorization", "Bearer " + c.token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.valid").value(true))
           .andExpect(jsonPath("$.violations.length()").value(0));
    }

    @Test
    void validate_illegal_lineup_lists_reasons() throws Exception {
        Ctx c = baseballGame("l3_");
        StringBuilder sb = new StringBuilder("{\"slots\":[");
        String[] pos = {"C","1B","2B","3B","SS","LF","CF","RF"};
        for (int i = 0; i < 8; i++) {
            String pid = addPlayer(c.token(), c.teamId(), "X" + i, pos[i]);
            if (i > 0) sb.append(",");
            sb.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1)
              .append(",\"fieldPosition\":\"").append(pos[i]).append("\",\"lineupStatus\":\"starter\"}");
        }
        String body = sb.append("]}").toString();
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mvc.perform(post("/api/games/" + c.gameId() + "/roster:validate").header("Authorization", "Bearer " + c.token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.valid").value(false))
           .andExpect(jsonPath("$.violations[?(@.code == 'PITCHER_MISSING')]").exists())
           .andExpect(jsonPath("$.violations[?(@.code == 'BATTING_COUNT_MISMATCH')]").exists());
    }

    @Test
    void confirm_legal_lineup_moves_status() throws Exception {
        Ctx c = baseballGame("l4_");
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(legalNineRoster(c.token(), c.teamId())))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + c.gameId()).header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.gameStatus").value("lineup_confirmed"));
    }

    @Test
    void confirm_illegal_lineup_returns_422() throws Exception {
        Ctx c = baseballGame("l5_");
        String pid = addPlayer(c.token(), c.teamId(), "Only", "P");
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"slots\":[{\"playerId\":\"" + pid + "\",\"battingOrder\":1,\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}"))
           .andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + c.gameId()).header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isUnprocessableEntity())
           .andExpect(jsonPath("$.violations").isArray());
    }

    @Test
    void friendly_ep_exceeds_defense_confirms() throws Exception {
        String t = token("l6_");
        String teamId = read(mvc.perform(post("/api/teams").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"T\",\"sportType\":\"softball_slow\"}"))
            .andReturn().getResponse().getContentAsString(), "$.teamId");
        String gbody = "{\"sportType\":\"softball_slow\",\"matchMode\":\"friendly\",\"basePresetId\":\"softball-friendly-ep\","
            + "\"dhEnabled\":false,\"epAllowed\":true,\"rosterSize\":10,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-05\",\"homeAway\":\"home\",\"opponentName\":\"Friends\"}";
        String gameId = read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(gbody))
            .andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF","SF"};
        StringBuilder sb = new StringBuilder("{\"slots\":[");
        for (int i = 0; i < 12; i++) {
            String pid = addPlayer(t, teamId, "S" + i, i < 10 ? pos[i] : "P");
            if (i > 0) sb.append(",");
            sb.append("{\"playerId\":\"").append(pid).append("\",\"battingOrder\":").append(i + 1);
            if (i < 10) sb.append(",\"fieldPosition\":\"").append(pos[i]).append("\"");
            sb.append(",\"lineupStatus\":\"starter\"}");
        }
        String rbody = sb.append("]}").toString();
        mvc.perform(put("/api/games/" + gameId + "/roster").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(rbody)).andExpect(status().isOk());
        mvc.perform(patch("/api/games/" + gameId).header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content("{\"gameStatus\":\"lineup_confirmed\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.gameStatus").value("lineup_confirmed"));
    }

    @Test
    void guest_slot_allowed() throws Exception {
        Ctx c = baseballGame("l7_");
        String body = "{\"slots\":[{\"guestName\":\"路人A\",\"battingOrder\":1,\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.slots[0].guestName").value("路人A"));
    }

    @Test
    void slot_with_both_sources_is_400() throws Exception {
        Ctx c = baseballGame("l8_");
        String pid = addPlayer(c.token(), c.teamId(), "Dup", "P");
        String body = "{\"slots\":[{\"playerId\":\"" + pid + "\",\"guestName\":\"X\",\"battingOrder\":1,\"fieldPosition\":\"P\",\"lineupStatus\":\"starter\"}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/roster").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }
}
