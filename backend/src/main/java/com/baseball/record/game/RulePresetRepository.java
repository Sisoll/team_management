package com.baseball.record.game;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RulePresetRepository extends JpaRepository<RulePreset, String> {
    List<RulePreset> findByMatchModeOrderByPresetId(String matchMode);
    List<RulePreset> findAllByOrderByPresetId();
}
