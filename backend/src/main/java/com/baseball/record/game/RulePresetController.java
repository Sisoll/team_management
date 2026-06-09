package com.baseball.record.game;

import com.baseball.record.game.dto.RulePresetResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rule-presets")
public class RulePresetController {
    private final RulePresetRepository presets;
    public RulePresetController(RulePresetRepository presets) { this.presets = presets; }

    @GetMapping
    public List<RulePresetResponse> list(@RequestParam(required = false) String sportType,
                                         @RequestParam(required = false) String matchMode) {
        List<RulePreset> rows = matchMode == null
            ? presets.findAllByOrderByPresetId()
            : presets.findByMatchModeOrderByPresetId(matchMode);
        return rows.stream().map(p -> new RulePresetResponse(
            p.getPresetId(), p.getLabel(), p.getSportType(), p.getMatchMode(),
            p.isDhAllowed(), p.isEpAllowed(), p.getDefaultRosterSize(),
            p.isReEntryAllowed(), p.isRosterFlex())).toList();
    }
}
