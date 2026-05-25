/*
 * PROJECT: VOID-CIRCUIT
 *
 * constants.js
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */

/**
 * GAME_CONFIG: ゲーム全体で共有する静的設定値
 */
const GAME_CONFIG = {
    WIDTH: 320,
    HEIGHT: 480,
    UI_HEADER_HEIGHT: 40,
    PLAYER_SPAWN_Y_OFFSET: 80,      // 画面下部からの配置オフセット
    PLAYER_SPAWN_WAIT_TIME: 90,     // ミス後の復活待機フレーム数
    PLAYER_SPAWN_INVINCIBLE_TIME: 180, // 復活後の無敵フレーム数
    FPS: 60,
};