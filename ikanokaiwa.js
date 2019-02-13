'use strict';

const helpMessage = '\
【ikanokaiwaの使い方】\
ikanokaiwa help：このヘルプを出します\
ikanokaiwa start：ikanokaiwaを始めます\
ikanokaiwa stop：ikanokaiwaを終わります\
ikanokaiwa channel (bot number) (channel id)：botが入室するチャンネルを設定します\
    bot number：設定するbotの番号，1〜3の数字\
    channle id：入室させるボイスチャンネルのid\
ikanokaiwa direction (ABCDEF)：音声の転送方向を設定します\
    ABCDEFにはそれぞれ0か1が当てはまり，1の場合は下記に示すように音声を転送します\
    A：1→2，B：1→3\
    C：2→1，D：2→3\
    E：3→1，F：3→2\
    ex) ikanokaiwa direction 010111：1→A，2→B，3→観戦とした設定\
';

// include modules
const fs = require('fs');
const path = require('path');
const config = require('config');
const Discord = require('discord.js');
const AudioMixer = require('audio-mixer');
const { PassThrough } = require('stream');

// setup Base Modules
const mixers = Array(config.botCount).fill(new AudioMixer.Mixer(config.mixerSetting));
const clients = Array(config.botCount).fill(new Discord.Client());

// load secrets
let tokens = [];
let voiceChannelIds = [];
if (fs.existsSync(config.secretPath)) {
	const secret = require(config.secretPath);
	tokens = secret.tokens;
	voiceChannelIds = secret.voiceChannelIds;
} else {
	// tokens and voiceChannelIds are split on comma
	const tokensText = process.env.tokens || '';
	tokens = tokensText.split(',');
	const voiceChannelIdsText = secret.voiceChannelIds || '';
	voiceChannelIds = voiceChannelIdsText.split(',');
}
// secrets validation
if (tokens.length < config.botCount) {
	console.error('tokens.length < config.botCount');
	process.exit(1);

}
if (voiceChannelIds.length < config.botCount) {
	console.error('voiceChannelIds.length < config.botCount');
	process.exit(1);
}


const client1 = new Discord.Client();
const client2 = new Discord.Client();
const client3 = new Discord.Client();


let mixer1 = new AudioMixer.Mixer(config.mixerSetting);
let mixer2 = new AudioMixer.Mixer(config.mixerSetting);
let mixer3 = new AudioMixer.Mixer(config.mixerSetting);

var voicech1;
var voicech2;
var voicech3;
var connection1;
var connection2;
var connection3;
var receiver1;
var receiver2;
var receiver3;
var pcmstream;

const input1to3 = mixer3.input({
	channels: 2,
	bitDepth: 16,
	sampleRate: 48000,
	volume: 100
});
const input2to3 = mixer3.input({
	channels: 2,
	bitDepth: 16,
	sampleRate: 48000,
	volume: 100
});
mixer1.pipe(input1to3);
mixer2.pipe(input2to3);


function start() {
	// ikanokaiwa1と2は，プレイヤーの音声をそれぞれのチャンネルのミキサーにまとめる
	voicech1 = client1.channels.resolve(voiceChannelIds[0]);
	voicech1.join().then(con => {
		connection1 = con;
		const dispatcher = connection1.play(config.setupSoundPath);
		dispatcher.on("end", () => {
			connection1.on("speaking", (user, speaking) => {
				console.log("@speaking " + speaking + " by " + user.username);
				if (speaking) {
					const input1 = mixer1.input({
						channels: 2,
						bitDepth: 16,
						sampleRate: 48000,
						volume: 100
					});
					input1.on("finish", () => {
						mixer1.removeInput(input1);
					});
					pcmstream = connection1.receiver.createStream(user, {mode:'pcm'});
					pcmstream.pipe(input1);
					pcmstream.on("end", () => {
						pcmstream.unpipe();
					});
				
				}
			});
		});
	}).catch(console.err);

	voicech2 = client2.channels.resolve(voiceChannelIds[1]);
	voicech2.join().then(con => {
		connection2 = con;
		const dispatcher = connection2.play(config.setupSoundPath);
		dispatcher.on("end", () => {
			connection2.on("speaking", (user, speaking) => {
				console.log("@speaking " + speaking + " by " + user.username);
				if (speaking) {
					const input2 = mixer2.input({
						channels: 2,
						bitDepth: 16,
						sampleRate: 48000,
						volume: 100
					});
					input2.on("finish", () => {
						mixer2.removeInput(input2);
					});
					pcmstream = connection2.receiver.createStream(user, {mode:'pcm'});
					pcmstream.pipe(input2);
					pcmstream.on("end", () => {
						pcmstream.unpipe();
					});
				}
			});
		});
	}).catch(console.err);

	// ikanokaiwa3は，ikanokaiwa1と2のミキサーの音声を合成して再生する
	voicech3 = client3.channels.resolve(voiceChannelIds[2]);
	voicech3.join().then(con => {
		connection3 = con;
		const hoge = connection3.play(config.setupSoundPath);
		hoge.on("end", () => {
			var pass = new PassThrough();
			mixer3.pipe(pass);
			pass.on("data", (chunk) => {
				console.log("*pass: " + chunk.length);
				pass.resume();
			});

			const pcm = fs.createWriteStream("./out.pcm");
			mixer3.pipe(pcm);
			mixer3.on("data", (chunk) => {
				console.log("*mixer: " + chunk.length);
				mixer3.resume();
			});
			console.log("mixer3 connected to 3");

			var dispatcher = connection3.play(mixer3, {
				type: 'converted',
				bitrate: '48'
			});
			dispatcher.on("start", () => {
				console.log("*dispatcher start");
			});
			dispatcher.on("speaking", (value) => {
				console.log("*dispatcher speaking: " + value);
			});
			dispatcher.on("debug", (info) => {
				console.log("*dispatcher debug: " + info);
			});
			dispatcher.on("error", (error) => {
				console.log("*dispatcher error: " + error);
			});
		});
	}).catch(console.err);
}

// ikanokaiwaくんstop
function stop() {
	if (voicech1) {
		voicech1.leave();
		voicech2.leave();
		voicech3.leave();
		voicech1 = null;
		voicech2 = null;
		voicech3 = null;
	}
}



client1.on('ready', () => { console.log(`Ready1!`); });

client2.on('ready', () => { console.log(`Ready2!`); });

client3.on('ready', () => { console.log(`Ready3!`); });

client1.on('message', msg => {
	if (msg.content === "ikanokaiwa help") {
		msg.reply(helpMessage);
	} else if (msg.content === 'ikanokaiwa start') {
		console.log("start");
		start();
	} else if (msg.content === 'ikanokaiwa stop') {
		console.log("stop");
		stop();
	}
});


client1.login(tokens[0]);
client2.login(tokens[1]);
client3.login(tokens[2]);

