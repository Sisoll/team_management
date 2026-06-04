package com.baseball.record.player;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PlayerControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String registerToken(String prefix) throws Exception {
        String email = prefix + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }
    String createTeam(String token) throws Exception {
        return com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");
    }

    @Test
    void create_player_only_display_name_required() throws Exception {
        String token = registerToken("p1_");
        String teamId = createTeam(token);
        mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"Amy\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.playerId").isNotEmpty())
           .andExpect(jsonPath("$.rosterStatus").value("active"))
           .andExpect(jsonPath("$.availability").value("available"));
    }

    @Test
    void duplicate_uniform_number_allowed_and_list_excludes_archived() throws Exception {
        String token = registerToken("p2_");
        String teamId = createTeam(token);
        String base = "/api/teams/" + teamId + "/players";
        mvc.perform(post(base).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"A\",\"uniformNumber\":\"00\"}")).andExpect(status().isCreated());
        mvc.perform(post(base).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"B\",\"uniformNumber\":\"00\"}")).andExpect(status().isCreated());

        mvc.perform(get(base).header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void update_writes_history_and_soft_delete_archives() throws Exception {
        String token = registerToken("p3_");
        String teamId = createTeam(token);
        String base = "/api/teams/" + teamId + "/players";
        String pid = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post(base).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"displayName\":\"Amy\",\"uniformNumber\":\"7\"}"))
                .andReturn().getResponse().getContentAsString(), "$.playerId");

        // 改背號 7 -> 10 + 主守位
        mvc.perform(patch(base + "/" + pid).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"uniformNumber\":\"10\",\"primaryPositions\":[\"SS\"]}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.uniformNumber").value("10"));

        // 歷史含 uniform_number 與 primary_positions 兩筆
        mvc.perform(get(base + "/" + pid + "/history").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2));

        // 軟刪
        mvc.perform(delete(base + "/" + pid).header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());

        // 列表預設不含 archived
        mvc.perform(get(base).header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(0));
        // includeArchived=true 可見
        mvc.perform(get(base + "?includeArchived=true").header("Authorization", "Bearer " + token))
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].rosterStatus").value("archived"));
    }
}
