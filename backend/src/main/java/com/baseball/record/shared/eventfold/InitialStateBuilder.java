package com.baseball.record.shared.eventfold;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;

/** 由出賽名單建初始 GameState（inning 1、依 homeAway 決定首半局攻守）。 */
public final class InitialStateBuilder {
    private InitialStateBuilder() {}

    public record InitialLineup(String homeAway, List<LineupEntry> lineup, UUID startingPitcherId) {}

    public static GameState initial(InitialLineup in) {
        // away → top 半局我隊先攻（offense）；home → top 半局我隊先守（defense）
        String half = "top";
        String battingSide = "away".equals(in.homeAway()) ? "offense" : "defense";
        UUID pitcher = "defense".equals(battingSide) ? in.startingPitcherId() : null;
        int firstOrder = "offense".equals(battingSide) ? 1 : 0;
        return new GameState(1, half, battingSide, 0, 0, 0, BaseState.empty(),
            firstOrder, pitcher, List.copyOf(in.lineup()), new HashMap<>(), new ArrayList<>());
    }
}
