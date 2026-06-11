package com.baseball.record.shared.eventfold;

import java.util.List;

/** 事件流摺疊：initial → 逐筆 apply。事件須已依 sequenceNo 排序。 */
public final class GameStateFolder {
    private GameStateFolder() {}

    public static GameState fold(InitialStateBuilder.InitialLineup lineup, List<EventView> events) {
        GameState s = InitialStateBuilder.initial(lineup);
        for (EventView ev : events) s = EventApplier.apply(s, ev);
        return s;
    }
}
