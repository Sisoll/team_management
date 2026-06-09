package com.baseball.record.game;

import jakarta.persistence.*;

@Entity
@Table(name = "rule_preset")
public class RulePreset {
    @Id @Column(name = "preset_id") private String presetId;
    @Column(name = "label", nullable = false) private String label;
    @Column(name = "sport_type", nullable = false) private String sportType;
    @Column(name = "match_mode", nullable = false) private String matchMode;
    @Column(name = "dh_allowed", nullable = false) private boolean dhAllowed;
    @Column(name = "ep_allowed", nullable = false) private boolean epAllowed;
    @Column(name = "default_roster_size", nullable = false) private int defaultRosterSize;
    @Column(name = "re_entry_allowed", nullable = false) private boolean reEntryAllowed;
    @Column(name = "roster_flex", nullable = false) private boolean rosterFlex;

    protected RulePreset() {}
    public String getPresetId() { return presetId; }
    public String getLabel() { return label; }
    public String getSportType() { return sportType; }
    public String getMatchMode() { return matchMode; }
    public boolean isDhAllowed() { return dhAllowed; }
    public boolean isEpAllowed() { return epAllowed; }
    public int getDefaultRosterSize() { return defaultRosterSize; }
    public boolean isReEntryAllowed() { return reEntryAllowed; }
    public boolean isRosterFlex() { return rosterFlex; }
}
