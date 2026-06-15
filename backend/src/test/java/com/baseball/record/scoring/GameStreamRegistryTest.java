package com.baseball.record.scoring;

import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class GameStreamRegistryTest {

    @Test
    void publish_sends_payload_to_subscribed_emitter() throws IOException {
        GameStreamRegistry reg = new GameStreamRegistry();
        UUID gameId = UUID.randomUUID();
        SseEmitter spy = mock(SseEmitter.class);
        reg.add(gameId, spy);

        Object payload = new Object();
        reg.publish(gameId, payload);

        verify(spy, atLeastOnce()).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test
    void publish_to_game_with_no_subscribers_is_noop() {
        GameStreamRegistry reg = new GameStreamRegistry();
        reg.publish(UUID.randomUUID(), new Object());   // 不丟例外
        assertThat(true).isTrue();
    }

    @Test
    void failed_send_removes_emitter() throws IOException {
        GameStreamRegistry reg = new GameStreamRegistry();
        UUID gameId = UUID.randomUUID();
        SseEmitter bad = mock(SseEmitter.class);
        doThrow(new IOException("boom")).when(bad).send(any(SseEmitter.SseEventBuilder.class));
        reg.add(gameId, bad);

        reg.publish(gameId, new Object());     // 第一次：send 失敗 → 移除
        reg.publish(gameId, new Object());     // 第二次：已無訂閱者
        verify(bad, times(1)).send(any(SseEmitter.SseEventBuilder.class));
    }
}
