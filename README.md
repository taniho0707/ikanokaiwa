# ikanokaiwa
[ikanopu](https://github.com/kamiyaowl/ikanopu)くんといっしょにお仕事がしたい

# 起動方法

## node.js(>= 10.15.1)で実行

```
$ npm installl (or yarn)
$ node app.js
```

# ギルド別設定

以下の方法でサーバID、チャンネルID、bot用のトークンなど秘密情報を指定可能です。最大数は`config`の`botCount`に従います。
`tokens`, `voiceChannelIds`の先頭に設定されたbot(ボイスチャット)は、その他のbotからの音声を受信してMixingするように機能します。

## `secret.json`を利用

読み込み先は`config.secretPath`で指定可能です。

```
{
    "tokens": [
        "<Lobby bot token here>",
        "<bot token here>",
        "<bot token here>"
    ],
    "voiceChannelIds": [
        "<Lobby voice channel id here>",
        "<target voice channel id here>",
        "<target voice channel id here>"
    ]
}
```

## 環境変数を利用

`secret.json`が見つからなかった場合はこちらを参照します。

----
変数名 | 備考 | 例 |
|-----|-------|------|
|tokens|複数指定可能、カンマ区切り| aaa,bbb,ccc|
|voiceChannelIds|複数指定可能、カンマ区切り| 0132,12312,4564|

# その他設定

`node-config`を採用しています。`confg/default.json`にある設定を利用することができます。

----
変数名 | 備考 | 例 |
|-----|-------|------|
|botCount|ハンドルするボットの数(tokens, voiceChannelIdsと数を一致させてください)|3
|secretPath|先のギルド別設定の保存場所。空白や存在しないパスの場合は環境変数から読み出します。|`./secret.json`
|startupSoundPath|ボイスチャット参加時に流す音声|`./startup.mp3`
|mixerSetting|音声ミキサーの設定です| [Object]
|mixerInputSetting|音声ミキサーの入力設定です| [Object]
|debug|開発者向けの余計な分岐を実行する場合はtrue|true
|log4js|ログ出力を編集することができます、コード上では`default`,`debug`,`error`に分類して出力しています| [Object]
