package com.baseball.record.game;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RulePresetControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String token() throws Exception {
        String email = "rp_" + UUID.randomUUID() + "@x.com";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"O\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(body, "$.token");
    }

    @Test
    void lists_seeded_presets() throws Exception {
        mvc.perform(get("/api/rule-presets").header("Authorization", "Bearer " + token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(6));
    }

    @Test
    void filters_by_match_mode() throws Exception {
        mvc.perform(get("/api/rule-presets?matchMode=formal").header("Authorization", "Bearer " + token()))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[?(@.matchMode != 'formal')]").isEmpty())
           .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    void requires_auth() throws Exception {
        mvc.perform(get("/api/rule-presets")).andExpect(status().isUnauthorized());
    }
}
