/*
 * PROJECT: VOID-CIRCUIT
 *
 * ga.js - Analytics Wrapper
 * 
 * Copyright (c) 2026 あに。部長 / Ryo Miura
 * Licensed under the MIT License (see LICENSE file)
 * Note: Included assets are the property of their respective owners.
 */
/*
 * PROJECT: VOID-CIRCUIT
 * ga.js - Google Analytics 4 Wrapper
 */

const Analytics = {
    /**
     * 内部用：GA4へのイベント送信（ガード付き）
     */
    _send(eventName, params = {}) {
        if (typeof gtag === 'function') {
            const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
            const finalParams = {
                ...params,
                debug_mode: isLocal
            };                
            gtag('event', eventName, finalParams);
            if (isLocal) {
                console.log(`[GA4 DEBUG] Sent: ${eventName}`, finalParams);
            }
        }
    },

    /**
     * ゲームの起動時（インデックスや初期化完了時に呼び出し）
     * @param {string} [version] - ゲームのバージョン（省略可）
     */
    logGameLaunch(version = "1.0.0") {
        // GA4推奨の game_app_launch を使用
        this._send('game_app_launch', {
            game_version: version
        });
    },

    /**
     * ゲーム開始時の記録
     * @param {Object} record - this.sessionRecord
     */
    logLevelStart(record) {
        this._send('level_start', {
            level_name: record.missionName,
            difficulty: record.difficulty,
            extend_setting: record.extend,
            initial_lives: record.lives,
            input_mode: record.inputMode,
            cheat_enabled: record.cheatUsed
        });
    },

    /**
     * ゲーム終了（リザルト）の記録
     * @param {Object} stats - this.stats (enemiesKilled, shotsFired, frame etc.)
     * @param {Object} record - this.sessionRecord
     * @param {boolean} isCleared - クリアフラグ
     */
    logLevelEnd(stats, record, isCleared) {
        // 命中率計算
        const accuracy = stats.shotsFired > 0 
            ? ((stats.shotsHit / stats.shotsFired) * 100).toFixed(3) 
            : "0.000";

        // 撃破率計算
        const killRate = stats.enemiesSpawned > 0 
            ? ((stats.enemiesKilled / stats.enemiesSpawned) * 100).toFixed(3) 
            : "0.000";

        // 生存時間（秒）
        const playTime = stats.frame ? Math.floor(stats.frame / 60) : 0;

        this._send('level_end', {
            level_name: record.missionName,
            success: isCleared,
            score: stats.score || 0,
            difficulty: record.difficulty,
            accuracy: parseFloat(accuracy), // 数値として送信
            kill_rate: parseFloat(killRate),
            play_time: playTime,
            input_mode: record.inputMode,
            cheat_used: record.cheatUsed,
            enemies_killed: stats.enemiesKilled,
            enemies_spawned: stats.enemiesSpawned
        });
    },

    /**
     * 実績解除（ハイスコア更新など）の記録
     * @param {string} achievementId - 'HI_SCORE_BREAK' 等
     */
    logAchievement(achievementId) {
        this._send('unlock_achievement', {
            achievement_id: achievementId
        });
    },

    /**
     * スコア確定・ハイスコア更新時の記録（GA4推奨：post_score）
     * @param {number} score - 獲得したスコア数値
     * @param {string} levelName - ステージ名（'all_stage', 'mission_01' など）
     * @param {string} [character] - 使用機体/キャラクター名（もしあれば・省略可）
     */
    logPostScore(score, levelName, character = "default") {
        this._send('post_score', {
            score: score,
            level_name: levelName,
            character: character
        });
    },

    /**
     * BGM TESTで曲を鳴らしたときの記録
     * @param {string} trackName - 曲名やID（例: "Stage 1 - Void", "bgm_01"）
     */
    logBgmTestPlay(trackName) {
        // コンテンツ選択イベントとして送信（独自の bgm_test_play でも可）
        this._send('select_content', {
            content_type: 'bgm_test',
            item_id: trackName
        });
    }
};