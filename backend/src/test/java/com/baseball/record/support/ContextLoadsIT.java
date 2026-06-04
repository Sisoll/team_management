package com.baseball.record.support;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ContextLoadsIT extends IntegrationTest {
    @Autowired MockMvc mvc;

    @Test
    @WithMockUser
    void context_loads_and_db_migrates() throws Exception {
        // 能啟動 = Flyway 對 Testcontainers Postgres 套用成功；@WithMockUser 讓 endpoint 在未設 SecurityConfig 時仍可通過認證
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
