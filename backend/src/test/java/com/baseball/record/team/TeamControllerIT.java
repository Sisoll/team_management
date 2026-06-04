package com.baseball.record.team;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TeamControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    /** 註冊一個使用者，回傳其 JWT。 */
    String registerToken(String prefix) throws Exception {
        String email = prefix + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }

    @Test
    void create_team_assigns_owner_and_lists_mine() throws Exception {
        String token = registerToken("owner1_");
        mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamName\":\"Tigers\",\"sportType\":\"baseball\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.teamId").isNotEmpty())
           .andExpect(jsonPath("$.teamStatus").value("active"))
           .andExpect(jsonPath("$.myRoles[0]").value("owner"));

        mvc.perform(get("/api/teams").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(1))
           .andExpect(jsonPath("$[0].teamName").value("Tigers"));
    }

    @Test
    void get_team_of_other_user_returns_404() throws Exception {
        String a = registerToken("a_");
        String teamId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + a)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"A\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");

        String b = registerToken("b_");
        mvc.perform(get("/api/teams/" + teamId).header("Authorization", "Bearer " + b))
           .andExpect(status().isNotFound());
    }

    @Test
    void rename_team_by_owner() throws Exception {
        String token = registerToken("owner2_");
        String teamId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"Old\",\"sportType\":\"softball_slow\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");

        mvc.perform(patch("/api/teams/" + teamId).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"teamName\":\"New\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.teamName").value("New"));
    }

    @Test
    void patch_ignores_sport_type_change() throws Exception {
        String token = registerToken("owner3_");
        String teamId = com.jayway.jsonpath.JsonPath.read(
            mvc.perform(post("/api/teams").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"teamName\":\"T\",\"sportType\":\"baseball\"}"))
                .andReturn().getResponse().getContentAsString(), "$.teamId");

        // sportType 不在 UpdateTeamRequest，PATCH body 內的 sportType 應被忽略、球種不變
        mvc.perform(patch("/api/teams/" + teamId).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"teamName\":\"T2\",\"sportType\":\"softball_slow\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.teamName").value("T2"))
           .andExpect(jsonPath("$.sportType").value("baseball"));
    }
}
