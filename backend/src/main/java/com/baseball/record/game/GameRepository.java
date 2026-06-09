package com.baseball.record.game;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface GameRepository extends JpaRepository<Game, UUID> {
    List<Game> findByTeamIdOrderByGameDateDesc(UUID teamId);
    List<Game> findByTeamIdAndGameStatusOrderByGameDateDesc(UUID teamId, String gameStatus);

    @Query("select distinct g.opponentName from Game g where g.teamId = :teamId "
         + "and g.opponentName is not null and lower(g.opponentName) like lower(concat('%', :q, '%')) "
         + "order by g.opponentName")
    List<String> suggestOpponents(@Param("teamId") UUID teamId, @Param("q") String q);
}
