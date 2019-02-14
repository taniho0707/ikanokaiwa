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

//////////////////////////////////////////////////////////////////////
// modules setup

// setup log4js
log4js.configure(config.log4js);
const defaultLogger = log4js.getLogger('default');
const debugLogger = log4js.getLogger('debug');
const errorLogger = log4js.getLogger('error');
process.on('unhandledRejection', errorLogger.error); // async func stacktrace
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

//////////////////////////////////////////////////////////////////////
// core function

// for mixers[0]
// returnValue: voiceChannel Reference(for leave and dispose)
const setupVoiceMixing = (mixer, client, channelId, debug) => {
	defaultLogger.info(`setupVoiceMixing ${channelId}`);
	const vc = client.channels.resolve(channelId);
	// join vc -> mixing stream
	vc.join().then(connection => {
		// passthrough debugprint(performance impact...)
		if (debug) {
			const pass = new PassThrough();
			mixers[0].pipe(pass);
			pass.on("data", (chunk) => {
				debugLogger.info(`[Mixing] pass:${chunk.length}`);
				pass.resume();
			});
			mixer.on("data", (chunk) => {
				debugLogger.info(`[Mixing] mix:${chunk.length}`);
				mixer.resume();
			});
			debugLogger.info("[Mixing] debug probe inserted");
		}
		// mixer -> vc stream
		const dispatcher = connection.play(mixer, {
			type: 'converted',
			bitrate: '48'
		});
		dispatcher.on("start", () => {
			debugLogger.info(`[Mixing] dispatcher start`);
		});
		dispatcher.on("speaking", (value) => {
			debugLogger.info(`[Mixing] dispatcher sepeaking:${value}`);
		});
		dispatcher.on("debug", (info) => {
			debugLogger.info(`[Mixing] dispatcher debug:${info}`);
		});
		dispatcher.on("error", (error) => {
			errorLogger.error(`[Mixing] dispatcher error:${error}`);
		});
	}).catch(errorLogger.error);
	return vc;
};

// for mixers[1: ...]
const setupVoiceCapture = (mixer, client, channelId, inputSetting) => {
	defaultLogger.info(`setupVoiceCapture ${channelId}`);
	const vc = client.channels.resolve(channelId);
	// join vc -> wait for speaking -> capture stream -> pipe mixer
	vc.join().then(connection => {
		connection.on("speaking", (user, speaking) => {
			debugLogger.info(`[Capture] speaking:${speaking} from:${user.username}`);
			if (speaking) {
				const input = mixer.input(inputSetting);
				input.on("finish", () => {
					mixer.removeInput(input);
					debugLogger.info(`[Capture] input remove from:${user.username}`);
				});
				const stream = connection.receiver.createStream(user, {mode: 'pcm'});
				stream.pipe(input);
				stream.on("end", () => {
					stream.unpipe();
					debugLogger.info(`[Capture] stop receive stream from:${user.username}`);
				});
				debugLogger.info(`[Capture] start receive stream from:${user.username}`);
			}
		});
	}).catch(errorLogger.error);
	return vc;
};


//////////////////////////////////////////////////////////////////////
// voicechat controll

// TODO: remove here
var voicech1;
var voicech2;
var voicech3;

const run = () => {
	// ikanokaiwa3は，ikanokaiwa1と2のミキサーの音声を合成して再生する
	voicech3 = setupVoiceMixing(mixers[0], clients[0], voiceChannelIds[0], config.debug);
	// ikanokaiwa1と2は，プレイヤーの音声をそれぞれのチャンネルのミキサーにまとめる
	voicech1 = setupVoiceCapture(mixers[1], clients[1], voiceChannelIds[1], config.mixerInputSetting);
	voicech2 = setupVoiceCapture(mixers[2], clients[2], voiceChannelIds[2], config.mixerInputSetting);
}

// ikanokaiwaくんstop
const stop = () => {
	if (voicech1) {
		voicech1.leave();
		voicech2.leave();
		voicech3.leave();
		voicech1 = null;
		voicech2 = null;
		voicech3 = null;
	}
}
const help = (msg) => {
	msg.reply(helpMessage);
};
//////////////////////////////////////////////////////////////////////
// command set
const commands = {
	"!kaiwa": help,
	"!kaiwa help": help,
	"!ikanokaiwa": help,
	"!ikanokaiwa help": help,

	"!kaiwa run": run,
	"!kaiwa start": run,
	"!ikanokaiwa run": run,
	"!ikanokaiwa start": run,

	"!kaiwa stop": stop,
	"!kaiwa end": stop,
	"!ikanokaiwa stop": stop,
	"!ikanokaiwa end": stop,
};
// handle clients[0] only
clients[0].on('message', msg => {
	const func = commands[msg.content];
	if(func) {
		defaultLogger.info(`[Receive command] ${msg.content}`);
		func(msg);
	}
});
//////////////////////////////////////////////////////////////////////
// start ikanokaiwa
clients.forEach((c, index) => {
	c.on('ready', () => defaultLogger.info('ready', index));
	c.login(tokens[index]);
	defaultLogger.info('login', index);
});