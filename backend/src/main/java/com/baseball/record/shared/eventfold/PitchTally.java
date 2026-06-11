package com.baseball.record.shared.eventfold;

/** 守備半局投手用球累計（offense 半局可為 null：對手投手非我方球員）。 */
public record PitchTally(int pitches, int strikes, int balls, int swinging, int looking) {
    public static PitchTally zero() { return new PitchTally(0, 0, 0, 0, 0); }
    public PitchTally plus(PitchTally o) {
        if (o == null) return this;
        return new PitchTally(pitches + o.pitches(), strikes + o.strikes(), balls + o.balls(),
            swinging + o.swinging(), looking + o.looking());
    }
}
