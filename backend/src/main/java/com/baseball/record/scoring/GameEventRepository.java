package com.baseball.record.scoring;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GameEventRepository extends JpaRepository<GameEvent, UUID> {
    List<GameEvent> findByGameIdOrderBySequenceNoAsc(UUID gameId);
    Optional<GameEvent> findTopByGameIdOrderBySequenceNoDesc(UUID gameId);
}
