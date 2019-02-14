'use strict';

const helpMessage = '\
【ikanokaiwaの使い方】\n\
ikanokaiwa help：このヘルプを出します\n\
ikanokaiwa start：ikanokaiwaを始めます\n\
ikanokaiwa stop：ikanokaiwaを終わります\n\
ikanokaiwa channel (bot number) (channel id)：botが入室するチャンネルを設定します\n\
    bot number：設定するbotの番号，1〜3の数字\n\
    channle id：入室させるボイスチャンネルのid\n\
ikanokaiwa direction (ABCDEF)：音声の転送方向を設定します\n\
    ABCDEFにはそれぞれ0か1が当てはまり，1の場合は下記に示すように音声を転送します\n\
    A：1→2，B：1→3\n\
    C：2→1，D：2→3\n\
    E：3→1，F：3→2\n\
    ex) ikanokaiwa direction 010111：1→A，2→B，3→観戦とした設定\n\
';

// include modules
const fs = require('fs');
const path = require('path');
const config = require('config');
const log4js = require('log4js');
const Discord = require('discord.js');
const AudioMixer = require('audio-mixer');
const { PassThrough } = require('stream');

// setup log4js
log4js.configure(config.log4js);
const defaultLogger = log4js.getLogger('default');
const errorLogger = log4js.getLogger('error');
defaultLogger.info('run ikanokaiwa');

// botCount validation
if(config.botCount < 2) {
	errorLogger.error('config.botCount < 2');
	process.exit(1);
}
// setup Base Modules
const mixers  = Array(config.botCount).fill(0).map(_ => new AudioMixer.Mixer(config.mixerSetting));
const clients = Array(config.botCount).fill(0).map(_ => new Discord.Client());

// mixer pipe setting(mixers[0] is lobby channel)
const inputPipes = 
	mixers.slice(1).map((m) =>{
		const inputPipe = mixers[0].input(config.mixerInputSetting);
		m.pipe(inputPipe);
		return inputPipe;
	});

// load secrets
let tokens = [];
let voiceChannelIds = [];
if (fs.existsSync(config.secretPath)) {
	const secret = JSON.parse(fs.readFileSync(config.secretPath));
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
	errorLogger.error('tokens.length < config.botCount');
	process.exit(1);

}
if (voiceChannelIds.length < config.botCount) {
	errorLogger.error('voiceChannelIds.length < config.botCount');
	process.exit(1);
}



// TODO: remove here
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

function start() {

		// ikanokaiwa3は，ikanokaiwa1と2のミキサーの音声を合成して再生する
		voicech3 = clients[0].channels.resolve(voiceChannelIds[0]);
		voicech3.join().then(con => {
			connection3 = con;
			const hoge = connection3.play(config.setupSoundPath);
			hoge.on("end", () => {
				var pass = new PassThrough();
				mixers[0].pipe(pass);
				pass.on("data", (chunk) => {
					defaultLogger.info("*pass: " + chunk.length);
					pass.resume();
				});
	
				const pcm = fs.createWriteStream("./out.pcm");
				mixers[0].pipe(pcm);
				mixers[0].on("data", (chunk) => {
					defaultLogger.info("*mixer: " + chunk.length);
					mixers[0].resume();
				});
				defaultLogger.info("mixer3 connected to 3");
	
				var dispatcher = connection3.play(mixers[0], {
					type: 'converted',
					bitrate: '48'
				});
				dispatcher.on("start", () => {
					defaultLogger.info("*dispatcher start");
				});
				dispatcher.on("speaking", (value) => {
					defaultLogger.info("*dispatcher speaking: " + value);
				});
				dispatcher.on("debug", (info) => {
					defaultLogger.info("*dispatcher debug: " + info);
				});
				dispatcher.on("error", (error) => {
					defaultLogger.info("*dispatcher error: " + error);
				});
			});
		}).catch(errorLogger.error);


		// ikanokaiwa1と2は，プレイヤーの音声をそれぞれのチャンネルのミキサーにまとめる
	voicech1 = clients[1].channels.resolve(voiceChannelIds[1]);
	voicech1.join().then(con => {
		connection1 = con;
		const dispatcher = connection1.play(config.setupSoundPath);
		dispatcher.on("end", () => {
			connection1.on("speaking", (user, speaking) => {
				defaultLogger.info("@speaking " + speaking + " by " + user.username);
				if (speaking) {
					const input1 = mixers[1].input({
						channels: 2,
						bitDepth: 16,
						sampleRate: 48000,
						volume: 100
					});
					input1.on("finish", () => {
						mixers[1].removeInput(input1);
					});
					pcmstream = connection1.receiver.createStream(user, {mode:'pcm'});
					pcmstream.pipe(input1);
					pcmstream.on("end", () => {
						pcmstream.unpipe();
					});
				
				}
			});
		});
	}).catch(errorLogger.error);

	voicech2 = clients[2].channels.resolve(voiceChannelIds[2]);
	voicech2.join().then(con => {
		connection2 = con;
		const dispatcher = connection2.play(config.setupSoundPath);
		dispatcher.on("end", () => {
			connection2.on("speaking", (user, speaking) => {
				defaultLogger.info("@speaking " + speaking + " by " + user.username);
				if (speaking) {
					const input2 = mixers[2].input({
						channels: 2,
						bitDepth: 16,
						sampleRate: 48000,
						volume: 100
					});
					input2.on("finish", () => {
						mixers[2].removeInput(input2);
					});
					pcmstream = connection2.receiver.createStream(user, {mode:'pcm'});
					pcmstream.pipe(input2);
					pcmstream.on("end", () => {
						pcmstream.unpipe();
					});
				}
			});
		});
	}).catch(errorLogger.error);
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


clients[0].on('message', msg => {
	if (msg.content === "ikanokaiwa help") {
		msg.reply(helpMessage);
	} else if (msg.content === 'ikanokaiwa start') {
		defaultLogger.info("start");
		start();
	} else if (msg.content === 'ikanokaiwa stop') {
		defaultLogger.info("stop");
		stop();
	}
});
clients.forEach((c, index) => {
	c.on('ready', () => defaultLogger.info('ready', index));
	c.login(tokens[index]);
	defaultLogger.info('login', index);
});