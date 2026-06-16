package com.baseball.record.signup;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SignupControllerIT extends IntegrationTest {
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
    String addPlayer(String token, String teamId, String name) throws Exception {
        String res = mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"" + name + "\",\"primaryPositions\":[\"P\"]}"))
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

    @Test
    void put_then_get_returns_signups() throws Exception {
        Ctx c = baseballGame("s1_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        String body = "{\"signups\":[{\"playerId\":\"" + pid + "\",\"status\":\"signed_up\",\"sortIndex\":0},"
            + "{\"guestName\":\"路人B\",\"status\":\"late\",\"note\":\"五點到\",\"sortIndex\":1}]}";
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content(body))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.signups.length()").value(2));
        mvc.perform(get("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.signups.length()").value(2))
           .andExpect(jsonPath("$.signups[1].guestName").value("路人B"))
           .andExpect(jsonPath("$.signups[1].status").value("late"));
    }

    @Test
    void put_replaces_previous() throws Exception {
        Ctx c = baseballGame("s2_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"playerId\":\"" + pid + "\",\"status\":\"signed_up\"}]}")).andExpect(status().isOk());
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON).content("{\"signups\":[]}")).andExpect(status().isOk());
        mvc.perform(get("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token()))
           .andExpect(jsonPath("$.signups.length()").value(0));
    }

    @Test
    void signup_with_both_sources_is_400() throws Exception {
        Ctx c = baseballGame("s3_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"playerId\":\"" + pid + "\",\"guestName\":\"X\"}]}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void duplicate_player_signup_is_409() throws Exception {
        Ctx c = baseballGame("s4_");
        String pid = addPlayer(c.token(), c.teamId(), "A");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"playerId\":\"" + pid + "\"},{\"playerId\":\"" + pid + "\"}]}"))
           .andExpect(status().isConflict());
    }

    @Test
    void invalid_status_is_400() throws Exception {
        Ctx c = baseballGame("s5_");
        mvc.perform(put("/api/games/" + c.gameId() + "/signups").header("Authorization", "Bearer " + c.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"signups\":[{\"guestName\":\"X\",\"status\":\"banana\"}]}"))
           .andExpect(status().isBadRequest());
    }
}
