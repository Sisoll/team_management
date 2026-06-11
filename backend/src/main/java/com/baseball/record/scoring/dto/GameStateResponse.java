package com.baseball.record.scoring.dto;

import com.baseball.record.shared.eventfold.GameState;

/** 直接回 fold 後的 GameState（前端據此渲染狀態列/鑽石/打序游標）。 */
public record GameStateResponse(GameState state) {}
