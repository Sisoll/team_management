package com.baseball.record.scoring;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** 每場一組 SSE 訂閱者；publish 推最新計分板 payload，送失敗即移除。in-memory（單機 MVP）。 */
@Component
public class GameStreamRegistry {
    private static final long TIMEOUT = 30 * 60 * 1000L;   // 30 分鐘
    private final Map<UUID, Set<SseEmitter>> subs = new ConcurrentHashMap<>();

    public SseEmitter subscribe(UUID gameId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT);
        add(gameId, emitter);
        emitter.onCompletion(() -> remove(gameId, emitter));
        emitter.onTimeout(() -> remove(gameId, emitter));
        emitter.onError(e -> remove(gameId, emitter));
        return emitter;
    }

    void add(UUID gameId, SseEmitter emitter) {
        subs.computeIfAbsent(gameId, k -> ConcurrentHashMap.newKeySet()).add(emitter);
    }
    private void remove(UUID gameId, SseEmitter emitter) {
        Set<SseEmitter> set = subs.get(gameId);
        if (set != null) { set.remove(emitter); if (set.isEmpty()) subs.remove(gameId); }
    }

    public void publish(UUID gameId, Object payload) {
        Set<SseEmitter> set = subs.get(gameId);
        if (set == null) return;
        for (SseEmitter e : Set.copyOf(set)) {
            try { e.send(SseEmitter.event().name("state").data(payload)); }
            catch (IOException | IllegalStateException ex) { remove(gameId, e); }
        }
    }
}
