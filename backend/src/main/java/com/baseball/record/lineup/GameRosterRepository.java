package com.baseball.record.lineup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface GameRosterRepository extends JpaRepository<GameRoster, UUID> {
    Optional<GameRoster> findByGameId(UUID gameId);
}
