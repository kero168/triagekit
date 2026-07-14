# triagekit

> GitHubのAI issueトリアージ — 重複検出・ラベル提案・再現手順の要求を、ActionまたはCLIで。

[![CI](https://github.com/kero168/triagekit/actions/workflows/ci.yml/badge.svg)](https://github.com/kero168/triagekit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/triagekit)](https://www.npmjs.com/package/triagekit)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English README](README.md) · [クイックスタート](docs/quickstart.md) · [Actionガイド](docs/action.md)

「動きません」というissueが来るたび、メンテナは同じ3つの質問を繰り返します。
**重複では？ どの種類のissue？ そもそも再現できる？**
triagekitはissueが開かれた瞬間にこの3つに答えます。しかも**APIキーなしで動作**します。
重複検出と分類はローカルのヒューリスティクスで実行され、LLMによる補強は完全なopt-inです。

GitHub Actions Marketplaceにはラベラーやstaleボットは溢れていますが、
「重複検出 + 分類 + 再現手順チェック」を1ステップで行う本格的なissueトリアージは
まだ手薄なカテゴリです。triagekitはそこのデファクトを目指します。

## 30秒デモ

```console
$ gh api repos/OWNER/REPO/issues/102 | npx triagekit analyze - --existing issues.json

triagekit v0.1.0 — #102 "It doesn't work, error every time"

Suggested labels
  bug      0.68  mentions an error or exception (in title); says something does not work (in title)

Possible duplicates (scanned 5 issues, threshold 0.45)
  none found

Reproduction checklist [0/4]
  - Version information  State the exact version of this project (and your runtime, e.g. Node.js) where the problem occurs.
  - Operating system / environment  Mention your OS or environment (e.g. macOS 14, Ubuntu 24.04, Windows 11, Docker, GitHub Actions runner).
  - Steps to reproduce  List the exact commands or numbered steps that trigger the problem, ideally in a code block.
  - Expected vs actual behavior  Describe what you expected to happen and what actually happened instead.
```

きちんと書かれた報告は `[4/4]` となり、催促の代わりにお礼が返ります。

## クイックスタート（CLI）

```bash
# GitHub CLIで取得したissueを解析
gh api repos/OWNER/REPO/issues/123 | npx triagekit analyze -

# ローカルのissue JSONを既存issue一覧と突き合わせて解析
npx triagekit analyze issue.json --existing issues.json

# 機械可読な出力
npx triagekit analyze issue.json --format json

# 既存issueの取得をCLIに任せる（重複検出にはトークンが必要）
GITHUB_TOKEN=$(gh auth token) npx triagekit analyze issue.json --repo OWNER/REPO
```

このリポジトリのfixtureですぐ試せます:

```bash
git clone https://github.com/kero168/triagekit && cd triagekit
npm install && npm run build
node dist/cli.js analyze examples/fixtures/bug-report-missing-repro.json \
  --existing examples/fixtures/existing-issues.json
```

## 4行であなたのリポジトリに導入

```yaml
steps:
  - uses: kero168/triagekit@v0
    with:
      github-token: ${{ github.token }}
```

完全なワークフロー（`.github/workflows/triage.yml`）:

```yaml
name: Issue triage
on:
  issues:
    types: [opened]

permissions:
  issues: write

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: kero168/triagekit@v0
        with:
          github-token: ${{ github.token }}
          # dry-run: 'true'      # コメントせずログ出力のみ（お試しに最適）
          # llm: 'true'          # LLM補強のopt-in（下記参照）
```

issueが開かれると、triagekitは提案ラベル・重複候補・不足している再現情報の
チェックリストを1つのコメントとして投稿します。再実行時は隠しマーカーで
**同じコメントを更新**するため、issueがbotコメントで溢れることはありません。
入力の一覧は [docs/action.md](docs/action.md) を参照してください。

## チェック内容

| チェック | 仕組み | APIキー |
| --- | --- | --- |
| **重複検出** | 既存issueタイトルとの文字3-gram + トークンJaccard類似度（完全ローカル） | 不要 |
| **ラベル提案**（`bug` / `feature` / `docs` / `question`） | 重み付きキーワードルール + マッチ理由の提示。LLMでの補強はオプション | 不要（LLMはopt-in） |
| **再現手順チェック** | 実用的なバグ報告の4要素を検出: バージョン・OS・手順・期待/実際 | 不要 |

すべての提案には理由（`"mentions a crash (in title)"` など）が付きます。
検証できないトリアージbotは、いずれ無効化されるからです。

## LLM補強（opt-in）

`--llm`（CLI）または `llm: 'true'`（Action）を指定し、いずれかのキーを設定します:

| プロバイダ | 環境変数 | デフォルトモデル |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-haiku-latest` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |

モデルは `TRIAGEKIT_LLM_MODEL` で上書きできます。プロバイダは組み込みの
`fetch` によるREST直呼び出しで、**SDK依存はゼロ**です。キーが無い、または
呼び出しが失敗した場合はルールベースの結果へフォールバックし、実行は決して
壊れません。

## 出力形式

- `--format pretty`（デフォルト）— 人間向けのターミナルレポート
- `--format json` — `AnalysisResult` 全体。構造は [ARCHITECTURE.md](ARCHITECTURE.md) に記載

## ロードマップ

- **v0.2** — 本文の類似度、ラベル分類のカスタマイズ（`.triagekit.json`）、`--apply-labels`
- **v0.3** — 既存バックログの一括解析（`triagekit sweep`）、GitLab対応
- **v1.0** — JSON出力契約の安定化、GHES検証、コメントテンプレートのi18n

詳細: [ROADMAP.md](ROADMAP.md)

## コントリビュート

ルールシグナルの追加、類似度の改善、実世界のfixture issueを特に歓迎します。
[CONTRIBUTING.md](CONTRIBUTING.md) から始めてください。テストは数秒で完走し、
APIキーは一切不要です。

## ライセンス

[MIT](LICENSE) © kero168
