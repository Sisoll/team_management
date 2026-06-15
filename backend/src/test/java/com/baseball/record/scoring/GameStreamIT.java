package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.GameStateResponse;
import com.baseball.record.support.IntegrationTest;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class GameStreamIT extends IntegrationTest {
    @Autowired MockMvc mvc;
    @MockitoSpyBean GameStreamRegistry registry;

    String token() throws Exception {
        String email = "sse" + UUID.randomUUID() + "@x.com";
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
    String liveGame(String t, String teamId) throws Exception {
        String body = "{\"sportType\":\"baseball\",\"matchMode\":\"formal\",\"basePresetId\":\"baseball-formal-9\","
            + "\"dhEnabled\":false,\"epAllowed\":false,\"rosterSize\":9,\"reEntryAllowed\":true,"
            + "\"gameDate\":\"2026-07-01\",\"homeAway\":\"away\",\"opponentName\":\"Foe\"}";
        String gameId = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/games").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getContentAsString(), "$.gameId");
        String[] pos = {"P","C","1B","2B","3B","SS","LF","CF","RF"};
        StringBuilder slots = new StringBuilder();
        for (int i = 0; i < 9; i++) {
            String pid = JsonPath.read(mvc.perform(post("/api/teams/" + teamId + "/players").header("Authorization", "Bearer " + t)
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

    @Test
    void recording_event_publishes_updated_snapshot_after_commit() throws Exception { // AC-10
        String t = token(); String teamId = createTeam(t);
        String gameId = liveGame(t, teamId);

        mvc.perform(post("/api/games/" + gameId + "/events").header("Authorization", "Bearer " + t)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"eventType\":\"HOME_RUN\",\"runnerMoves\":[{\"from\":\"B\",\"to\":\"H\"}]}"))
           .andExpect(status().isCreated());

        ArgumentCaptor<Object> payload = ArgumentCaptor.forClass(Object.class);
        verify(registry, timeout(2000)).publish(org.mockito.ArgumentMatchers.eq(UUID.fromString(gameId)), payload.capture());
        GameStateResponse pushed = (GameStateResponse) payload.getValue();
        assertThat(pushed.state().scoreUs()).isEqualTo(1);    // 推出的 snapshot 已含新比分
    }
}
