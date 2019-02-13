# ikanokaiwa
ikanopuくんといっしょにお仕事がしたい

# ギルド別設定

以下の方法でサーバID、チャンネルID、bot用のトークンなど秘密情報を指定可能です。最大数は`config`の`botCount`に従います。

## `secret.json`を利用

読み込み先は`config.secretPath`で指定可能です。

```
{
    "tokens": [
        "<bot token here>",
        "<bot token here>",
        "<bot token here>"
    ],
    "voiceChannelIds": [
        "<target voice channel id here>",
        "<target voice channel id here>",
        "<target voice channel id here>"
    ]
}
```

## 環境変数を利用

----
変数名 | 備考 | 例 |
|-----|-------|------|
|tokens|複数指定可能、カンマ区切り| aaa,bbb,ccc|
|voiceChannelIds|複数指定可能、カンマ区切り| 0132,12312,4564|

