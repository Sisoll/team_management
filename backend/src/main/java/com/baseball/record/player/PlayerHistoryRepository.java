package com.baseball.record.player;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PlayerHistoryRepository extends JpaRepository<PlayerHistory, UUID> {
    List<PlayerHistory> findByPlayerIdOrderByChangedAtDesc(UUID playerId);
}
