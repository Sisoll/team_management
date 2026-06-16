package com.baseball.record.signup;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface GameSignupRepository extends JpaRepository<GameSignup, UUID> {
    List<GameSignup> findByGameIdOrderBySortIndexAsc(UUID gameId);

    @Modifying
    @Query("delete from GameSignup s where s.gameId = :gameId")
    void deleteByGameId(@Param("gameId") UUID gameId);
}
