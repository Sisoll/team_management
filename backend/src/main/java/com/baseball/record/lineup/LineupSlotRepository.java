package com.baseball.record.lineup;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface LineupSlotRepository extends JpaRepository<LineupSlot, UUID> {
    List<LineupSlot> findByGameRosterId(UUID gameRosterId);
    void deleteByGameRosterId(UUID gameRosterId);
}
