# GitHub Pages公開手順

このアプリは静的ファイルだけで動くため、GitHub Pagesにそのまま公開できます。

## 1. GitHubにアップロードするファイル

最低限、以下をリポジトリに置きます。

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `requirements.md`

ローカル起動用の以下は、置いても問題ありません。

- `start-app-hidden.bat`
- `start-app-hidden.ps1`
- `stop-app-server.bat`
- `stop-app-server.ps1`

## 2. GitHub Pagesを有効にする

GitHubの対象リポジトリを開きます。

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. `Source` を `Deploy from a branch`
5. `Branch` を `main` にする
6. フォルダは `/ (root)` を選ぶ
7. `Save`

数分後、以下のようなURLで公開されます。

```text
https://ユーザー名.github.io/リポジトリ名/
```

## 3. Google OAuthにURLを追加する

スマホからYouTube同期を使うには、Google Cloud ConsoleのOAuthクライアントIDに、GitHub PagesのURLを追加します。

Google Cloud Console:

```text
https://console.cloud.google.com/apis/credentials
```

対象のOAuthクライアントIDを開き、`承認済みの JavaScript 生成元` に以下を追加します。

```text
https://ユーザー名.github.io
```

注意: 末尾にリポジトリ名やスラッシュは付けません。`https://ユーザー名.github.io` までです。

## 4. スマホで開く

スマホのブラウザで、GitHub PagesのURLを開きます。

```text
https://ユーザー名.github.io/リポジトリ名/
```

歯車ボタンからGoogle OAuthクライアントIDを入力して保存し、YouTube同期を実行します。

## 5. 注意点

- PCとスマホのメタデータは自動同期されません。
- タグ、メモ、お気に入りはブラウザごとに保存されます。
- PCのデータをスマホへ移したい場合は、PCでJSONエクスポートし、スマホでJSONインポートします。
- YouTube動画は限定公開にしておくと、家族共有しやすいです。
