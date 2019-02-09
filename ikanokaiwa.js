'use strict';

const { PassThrough } = require('stream')
var fs = require('fs');

var helpmessage = "\n【ikanokaiwaの使い方】\nikanokaiwa help：このヘルプを出します\nikanokaiwa start：ikanokaiwaを始めます\nikanokaiwa stop：ikanokaiwaを終わります\nikanokaiwa channel (bot number) (channel id)：botが入室するチャンネルを設定します\n    bot number：設定するbotの番号，1〜3の数字\n    channle id：入室させるボイスチャンネルのid\nikanokaiwa direction (ABCDEF)：音声の転送方向を設定します\n    ABCDEFにはそれぞれ0か1が当てはまり，1の場合は下記に示すように音声を転送します\n    A：1→2，B：1→3\n    C：2→1，D：2→3\n    E：3→1，F：3→2\n    ex) ikanokaiwa direction 010111：1→A，2→B，3→観戦とした設定";

var ids = [{}];

// 挨拶用の音声ファイルを指定
var aisatsu = "./resource/aisatsu.mp3";

const Discord = require('discord.js');
const client1 = new Discord.Client();
const client2 = new Discord.Client();
const client3 = new Discord.Client();

var AudioMixer = require('audio-mixer');

let mixer1 = new AudioMixer.Mixer({
	channels: 2,
	bitDepth: 16,
	sampleRate: 48000,
	clearInterval: 250
});
let mixer2 = new AudioMixer.Mixer({
	channels: 2,
	bitDepth: 16,
	sampleRate: 48000,
	clearInterval: 250
});
let mixer3 = new AudioMixer.Mixer({
	channels: 2,
	bitDepth: 16,
	sampleRate: 48000,
	clearInterval: 250
});

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
	voicech1 = client1.channels.resolve(ids[1].channel);
	voicech1.join().then(con => {
		connection1 = con;
		const dispatcher = connection1.play(aisatsu);
		dispatcher.on("end", () => {
			connection1.on("speaking", (user, speaking) => {
				console.log("@speaking " + speaking + " by " + user.username);
				if (speaking) {
					if (ids[1].sendto3) {
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
				}
			});
		});
	}).catch(console.err);

	voicech2 = client2.channels.resolve(ids[2].channel);
	voicech2.join().then(con => {
		connection2 = con;
		const dispatcher = connection2.play(aisatsu);
		dispatcher.on("end", () => {
			connection2.on("speaking", (user, speaking) => {
				console.log("@speaking " + speaking + " by " + user.username);
				if (speaking) {
					if (ids[1].sendto3) {
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
				}
			});
		});
	}).catch(console.err);

	// ikanokaiwa3は，ikanokaiwa1と2のミキサーの音声を合成して再生する
	voicech3 = client3.channels.resolve(ids[3].channel);
	voicech3.join().then(con => {
		connection3 = con;
		const hoge = connection3.play(aisatsu);
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

function loadID() {
	return JSON.parse(fs.readFileSync('./ikanokaiwa.json', 'utf8'));
}

function saveID() {
	fs.writeFile('./ikanokaiwa.json', JSON.stringify(ids, null, '    '));
}

client1.on('ready', () => { console.log(`Ready1!`); });

client2.on('ready', () => { console.log(`Ready2!`); });

client3.on('ready', () => { console.log(`Ready3!`); });

client1.on('message', msg => {
	if (msg.content === "ikanokaiwa help") {
		msg.reply(helpmessage);
	} else if (msg.content === 'ikanokaiwa start') {
		console.log("start");
		start();
	} else if (msg.content === 'ikanokaiwa stop') {
		console.log("stop");
		stop();
	}
});


ids = loadID();
console.log(ids);

client1.login('ikanokaiwa1 TOKEN');
client2.login('ikanokaiwa2 TOKEN');
client3.login('ikanokaiwa3 TOKEN');

