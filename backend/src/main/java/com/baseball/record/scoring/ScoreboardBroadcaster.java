package com.baseball.record.scoring;

import com.baseball.record.scoring.dto.GameStateResponse;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class ScoreboardBroadcaster {
    private final GameStreamRegistry registry;
    public ScoreboardBroadcaster(GameStreamRegistry registry) { this.registry = registry; }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onChange(ScoreboardChanged e) {
        registry.publish(e.gameId(), new GameStateResponse(e.state()));
    }
}
