package com.baseball.record.auth;

import com.baseball.record.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthControllerIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    String register(String email) throws Exception {
        return mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Amy\",\"email\":\"" + email + "\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
    }

    @Test
    void register_returns_201_and_token() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Amy\",\"email\":\"a@x.com\",\"password\":\"pw123456\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.token").isNotEmpty());
    }

    @Test
    void duplicate_email_returns_409() throws Exception {
        register("dup@x.com");
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"B\",\"email\":\"dup@x.com\",\"password\":\"pw123456\"}"))
           .andExpect(status().isConflict());
    }

    @Test
    void login_valid_returns_token_invalid_returns_401() throws Exception {
        register("login@x.com");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"login@x.com\",\"password\":\"pw123456\"}"))
           .andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"login@x.com\",\"password\":\"wrong\"}"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void me_requires_token_and_returns_user() throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Amy\",\"email\":\"me@x.com\",\"password\":\"pw123456\"}"))
            .andReturn().getResponse().getContentAsString();
        String token = com.jayway.jsonpath.JsonPath.read(body, "$.token");

        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.email").value("me@x.com"));
    }
}
