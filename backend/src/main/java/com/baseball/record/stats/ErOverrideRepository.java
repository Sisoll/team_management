package com.baseball.record.stats;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ErOverrideRepository extends JpaRepository<ErOverride, UUID> {
    Optional<ErOverride> findByGameIdAndPitcherId(UUID gameId, UUID pitcherId);
    List<ErOverride> findByGameId(UUID gameId);
}
