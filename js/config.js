/**
 * 設定画面（BIOS風）を管理するクラス
 */
class ConfigManager {
    constructor(game) {
        this.game = game;
        this.isMode = false;
        this.currentIndex = 0;
        
        // デフォルト設定
        this.difficulty = 'NORMAL'
        this.lives = 3
        this.extend = 500000
        
        // 設定の選択肢定義
        this.OPTIONS = {
            difficulty: ['EASY', 'NORMAL', 'HARD', 'VERY HARD'],
            lives: [1, 2, 3, 5],
            extend: [300000, 500000, 1000000, 'NONE']
        };

        this.items = [];
        this.screenEl = document.getElementById('config-screen');
        this.startScreenEl = document.getElementById('start-screen');

        this.soundTestIndex = 0; // 現在選択されている音
        this.bgmTestIndex = 0;   // BGMインデックスもここへ
    }

    // 設定画面を開く
    open() {
        this.isMode = true;
        this.startScreenEl.style.display = 'none';
        this.screenEl.style.display = 'flex';
        this.items = document.querySelectorAll('.config-item');
        this.setupMouseEvents();
        this.updateSelection();
    }

    // 設定画面を閉じる
    close() {
        this.isMode = false;
        this.screenEl.style.display = 'none';
        this.startScreenEl.style.display = 'flex';
    }

    // キー入力処理
    handleInput(e) {
        if (!this.isMode) return;

        // 上下移動
        if (e.code === 'ArrowUp') {
            this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
            this.updateSelection();
        } else if (e.code === 'ArrowDown') {
            this.currentIndex = (this.currentIndex + 1) % this.items.length;
            this.updateSelection();
        }

        const currentItem = this.items[this.currentIndex];
        const setting = currentItem.dataset.setting;

        // 左右（値の変更）
        if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
            const isRight = e.code === 'ArrowRight';
            this.changeValue(setting, isRight, currentItem);
        }

        // 決定（Z / Space）
        if (e.code === 'KeyZ' || e.code === 'Space') {
            if (setting === 'sound') {
                this.playBackSoundTest();
            } else if (setting === 'bgm') {
                this.playBackBGMTest();
            } else if (setting === 'exit') {
                this.game.audio.resetBGM();
                this.close();
            }
        }
    }

    // 値を変更する内部メソッド
    changeValue(setting, isRight, element) {
        const options = this.OPTIONS[setting];
        
        if (options) {
            let val = this.game.config[setting];
            let idx = options.indexOf(val);
            idx = isRight ? (idx + 1) % options.length : (idx - 1 + options.length) % options.length;
            this.game.config[setting] = options[idx];
            element.querySelector('.value').innerText = this.game.config[setting];
        } else if (setting === 'sound') {
            const len = this.game.audio.seCount;
            this.soundTestIndex = isRight ? 
                (this.soundTestIndex + 1) % len : 
                (this.soundTestIndex - 1 + len) % len;
            
            const seName = this.game.audio.getSEName(this.soundTestIndex);
            element.querySelector('.value').innerText = `< ${seName} >`;
        } else if (setting === 'bgm') {
        const len = this.game.audio.bgmCount;
        this.bgmTestIndex = isRight ? 
            (this.bgmTestIndex + 1) % len : 
            (this.bgmTestIndex - 1 + len) % len;
        
        const name = this.game.audio.getBGMName(this.bgmTestIndex);
        element.querySelector('.value').innerText = `< ${name} >`;        
        }
    }

    // 選択状態（activeクラス）の更新
    updateSelection() {
        this.items.forEach((item, index) => {
            item.classList.toggle('active', index === this.currentIndex);
        });
    }

    // マウスイベントの登録
    setupMouseEvents() {
        this.items.forEach((item, index) => {
            // 重複登録を避けるため一度削除して追加（または一度きりの登録にする）
            item.onclick = (e) => {
                e.stopPropagation();
                const setting = item.dataset.setting;
                if (setting === 'exit') {
                    this.game.audio.resetBGM();
                    this.close();
                } else {
                    this.changeValue(setting, true, item);
                    if (setting === 'sound') this.playBackSoundTest();
                    if (setting === 'bgm') this.playBackBGMTest();
                }
            };
            item.onmouseenter = () => {
                this.currentIndex = index;
                this.updateSelection();
            };
        });
    }
    // サウンドテスト実行
    playBackSoundTest() {
        this.game.audio.playSEByIndex(this.soundTestIndex);
    }

    // BGMテスト実行
    playBackBGMTest() {
        this.game.audio.playBGMByIndex(this.bgmTestIndex);
    }
}