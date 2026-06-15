package com.baseball.record.scoring;

import com.baseball.record.shared.eventfold.GameState;
import java.util.UUID;

/** 記錄事件成功後發佈，攜帶已算好的最新 GameState；AFTER_COMMIT 推給訂閱者。 */
public record ScoreboardChanged(UUID gameId, GameState state) {}
