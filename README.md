# [PROJECT: VOID-CIRCUIT]
**80s-style hardcore vertical scrolling shooter.** **Inspired by Suno AI music. Co-authored with Google Gemini.**

* このREADME.md も AIによって書かれています。すごいね、AI（あに。部長）

---

## 🚀 OVERVIEW
`VOID-CIRCUIT` は、80年代のアーケードゲームが持っていた「手応え」と「熱量」を現代のブラウザ上に再構築するプロジェクトです。

Suno AIが生成したノスタルジックな楽曲からインスピレーションを受け、その世界観を表現するために Google Gemini との共創（Co-authored）によって開発されました。極限まで削ぎ落とされた操作性と、MISSIONコードによって刻まれる戦績が特徴です。

- **URL:** [https://void-circuit.ani-net.com](https://void-circuit.ani-net.com)

---

## 🎮 MANUAL (操作マニュアル)

### 1. 基本操作
本作はキーボードとマウス（タッチ）の両方に対応しており、状況に応じてシームレスに切り替え可能です。

| アクション | キーボード | マウス / タッチ |
| :--- | :--- | :--- |
| **自機の移動** | 矢印キー (↑↓←→) | ポインタに追従 |
| **ショット** | [Z] または [Space] | 画面を押し続ける |
| **武器換装** | [X] | 画面サイドのUIをクリック |
| **強制離脱** | [Esc] を2回連続 | (なし) |

### 2. 武器システム (WEAPON)
状況に合わせて2つのモードを使い分けることが攻略の鍵です。
- **STRAIGHT**: 正面への集中連射。耐久力の高い敵に有効。
- **WIDE**: 3方向への拡散弾。小型機の集団を掃討するのに最適。

### 3. エクステンド (機体増加)
設定されたスコアに到達すると、残機が1機増加します（デフォルト：50,000点）。

---

## 📊 MISSION REPORT (リザルトの見方)
ゲーム終了時、あなたの戦績は以下の形式でコード化されます。

`STAGE1 - N - 50k - L3 - MK`
1. **シナリオ名**: 攻略したステージ名
2. **難易度**: E (Easy) / N (Normal) / H (Hard) / VH (Very Hard)
3. **EXTEND設定**: 増加タイミング (50k = 50,000点 / OFF = なし)
4. **初期残機**: L3 = 3機設定
5. **操作モード**: -K (Keyboard) / -M (Mouse) / -MK (Both)

---

## 🛠 FOR DEVELOPERS (シナリオ開発)
本プロジェクトは、GitHubのブランチ機能を活用した「ユーザー投稿型シナリオ」に対応しています。

### シナリオのテスト方法
URLパラメータに `branch` を指定することで、メインブランチ以外の `scenario.json` を読み込んでプレイ可能です。
`https://void-circuit.ani-net.com/?branch=your-branch-name`

### シナリオの整合性チェック
プログラムはシナリオファイルの `version` フィールドを確認します。
- 現在の要求バージョン: **v0.1 以上**
- バージョンが不足している場合、ロードエラーが表示されます。

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
