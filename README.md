# [PROJECT: VOID-CIRCUIT]
**80s-style hardcore vertical scrolling shooter.** **Inspired by Suno AI music. Co-authored with Google Gemini.**

* このREADME.md も AIによって書かれています。すごいね、AI（あに。部長）

---

## 🚀 OVERVIEW
`VOID-CIRCUIT` は、80年代のアーケードゲームが持っていた硬質な「手応え」と「熱量」を現代のブラウザ上に再構築する、オープン・データ駆動型シューティングゲームです。

Suno AIが生成したノスタルジックな楽曲からインスピレーションを受け、その世界観を表現するために、Google Geminiとの共創（Co-authored）によって開発されました。
コアシステムからハードコードを排除し、「データがすべてを決める」アーキテクチャにより、ステージデザイン、BGM、背景演出にいたるまで完全に動的な制御を実現しています。

- **URL:** [https://void-circuit.ani-net.com](https://void-circuit.ani-net.com)

---

## 🎮 MANUAL (操作マニュアル)

### 1. 基本操作
本作はキーボードとマウス（タッチ）の両方に対応しており、状況に応じてシームレスに切り替え可能です。

| アクション | キーボード | マウス / タッチ |
| :--- | :--- | :--- |
| **自機の移動** | 矢印キー (↑↓←→) | ポインタに完全追従 |
| **ショット** | `[Z]` または `[Space]` | 画面をホールド |
| **武器換装** | `[X]` | 画面サイドのUIをタップ |
| **緊急脱出（割腹）** | `[Esc]` を2回連続連打 | (なし) |

### 2. 武器システム (WEAPON)
状況に合わせて2つのモードを瞬時に切り替えることが生存への唯一の鍵です。
- **STRAIGHT**: 正面への高密度集中連射。耐久力の高い中型機・ボスに絶大な威力を発揮。
- **WIDE**: 3方向への拡散弾。画面を埋め尽くす小型機の集団を瞬時に掃討する。

### 3. エクステンド (機体増加)
設定された基準スコアに到達すると、残機が1機増加します（デフォルト：5,000,000点）。

---

## 📊 MISSION REPORT (リザルトの暗号解読)
ゲーム終了時、あなたの戦績は以下の形式で暗号のような「MISSIONコード」として生成され、X（旧Twitter）等へ直接シアイ可能です。

`IRON VEIN-NM-3L-5M-MK`
1. **MISSION NAME**: 攻略、または戦破されたステージの名称（YAMLから動的取得）
2. **難易度**: `EZ` (Easy) / `NM` (Normal) / `HD` (Hard) / `VH` (Very Hard)
3. **初期残機**: `1L` / `2L` / `3L` / `5L`（ライフ設定）
4. **EXTEND設定**: 増加タイミング (`3M` = 3,000,000点 / `OFF` = なし)
5. **操作モード**: `-K` (Keyboard) / `-M` (Mouse) / `-MK` (Both: 両方使用)

---

## 🛠 FOR DEVELOPERS & SCENARIO CREATORS

本プロジェクトは、GitHubのブランチ機能と**完全データ駆動（YAML）システム**を活用した、ユーザー投稿型シナリオ・ステージ拡張に対応しています。

### シナリオのテスト方法
URLパラメータに `branch` を指定することで、メインブランチ以外のシナリオを読み込んでプレイ可能です。
`https://void-circuit.ani-net.com/?branch=your-branch-name`

### シナリオの整合性チェック
プログラムはシナリオファイルの `version` フィールドを確認します。
- 現在の要求バージョン: **v0.1 以上**
- バージョンが不足している場合、ロードエラーが表示されます。

### シナリオYAMLの設計
各ステージは `stage-${stageNum}/scenario.yaml` にて定義されます。メタデータ、BGM、背景色、およびフレーム単位の敵出現タイムラインをコントロールできます。

```yaml
name: "Iron Vein"
bgm: "bgm-stage1.ogg"
bgColor: "#000000"
version: "0.2"
scenario:
  - { frame: 60,  x: 60,  type: "straight", hp: 1, bulletType: "straight" }
  - { frame: 500, x: 160, type: "boss_01", hp: 100 }
  - { frame: 9999, type: "LOOP_END", returnTo: 500 } # ボス戦無限湧きループ制御

  
---

## 🛠 TECH STACK
- **Engine:** Vanilla JavaScript (No Frameworks)
- **Audio:** Suno AI Generated Music
- **Programming Assistant:** Google Gemini (Advanced/Pro)
- **Hosting:** GitHub Pages

---

## ⚖️ RIGHTS & LICENSES

### Core System
Copyright (c) 2026 あに。部長 / Ryo Miura  
Licensed under the [MIT License](LICENSE).

### Branch Assets & Scenarios
各ブランチ（`main` 以外）で公開されているシナリオファイル（JSON）、画像、音声などのアセットについては、**それぞれのブランチの作成者（コントリビューター）に帰属します。**

1. **権利の分離**: 本プロジェクトの管理者は、他者が作成したブランチ内のアセットについて、その内容や権利状況を保証しません。
2. **投稿ルール**: ブランチを作成・公開する際は、必ず自身が権利を保有しているか、適切なライセンス（CC0など）が適用されている素材を使用してください。
3. **利用許可**: ブランチにアセットをプッシュした時点で、そのアセットが `VOID-CIRCUIT` のシステム上で読み込まれ、ユーザーによってプレイされることを許諾したものとみなします。

---

## 🔒 PRIVACY POLICY (プライバシーポリシー)

本プロジェクト「VOID-CIRCUIT」では、ユーザーの利用状況を把握し、ゲーム体験の向上および改善を行うため、Google Analyticsを使用しています。

### 1. データの収集について
Google Analyticsは「Cookie」を使用して、トラフィックデータを収集します。
収集される主なデータは以下の通りです：
- 閲覧したページやボタンのクリックイベント
- ゲームのプレイ回数、クリア状況、スコア統計
- 使用されているブラウザやデバイスの種類

### 2. データの匿名性
収集されるデータは匿名であり、氏名、住所、メールアドレス、電話番号などの個人を特定する情報は一切含まれません。

### 3. クッキー（Cookie）の無効化
ユーザーはブラウザの設定でCookieを無効にすることにより、データの収集を拒否することが可能です。詳細については、お使いのブラウザのヘルプ設定をご確認ください。

### 4. Google Analyticsの利用規約
収集されたデータの取り扱いについては、Google社のプライバシーポリシーおよび規約に基づきます。
- [Google Analytics利用規約](https://marketingplatform.google.com/about/analytics/terms/jp/)
- [Googleポリシーと規約](https://policies.google.com/privacy?hl=ja)

---

### ✍️ Creator's Note
「AIとの対話によって、かつての熱狂を再構築する」  
このゲームは、音楽・コード・アイデアがAIと人間の境界を越えて融合した実験作でもあります。虚無の回路（VOID-CIRCUIT）の果てに何があるのか、その目で確かめてください。
