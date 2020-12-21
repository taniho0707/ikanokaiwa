#!/usr/bin/env node
'use strict';

const helpMessage = '\
【ikanokaiwaの使い方】\n\
!kaiwa：このヘルプを出します\n\
!kaiwa run：ikanokaiwaを始めます\n\
!kaiwa stop：ikanokaiwaを終わります\n\
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
process.on('unhandledRejection', errorLogger.error.bind(errorLogger)); // async func stacktrace
defaultLogger.info('run ikanokaiwa');

// botCount validation
if(config.botCount < 2) {
	errorLogger.error('config.botCount < 2');
	process.exit(1);
}

// startup sound
if(!fs.existsSync(config.startupSoundPath)) {
	errorLogger.error(`startupSound not found [${config.startupSoundPath}]`);
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

const cleanUp = () => {
	clients.map((c) => {
		c.destroy();
	});
	process.exit(0);
};

process.on('SIGTERM', cleanUp);
process.on('SIGINT', cleanUp);

//////////////////////////////////////////////////////////////////////
// core function

// for mixers[0]
// returnValue: voiceChannel Reference(for leave and dispose)
const setupVoiceMixing = (mixer, client, channelId, debug, soundPath) => {
	defaultLogger.info(`setupVoiceMixing ${channelId}`);
	const vc = client.channels.resolve(channelId);
	// join vc -> mixing stream
	vc.join().then(connection => {
		// play startup sound
		connection.play(soundPath).on('speaking', (value) => {
			if(value) return;
			defaultLogger.info(`[Mixing] Join ${vc.name}`);
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
			// dispatcher.on("speaking", (value) => {
			// 	debugLogger.info(`[Mixing] dispatcher speaking:${value}`);
			// });
			// dispatcher.on("debug", (info) => {
			// 	debugLogger.info(`[Mixing] dispatcher debug:${info}`);
			// });
			dispatcher.on("error", (error) => {
				errorLogger.error(`[Mixing] dispatcher error:${error}`);
			});
		});
	}).catch(errorLogger);
	return vc;
};

// for mixers[1: ...]
const setupVoiceCapture = (mixer, client, channelId, inputSetting, soundPath) => {
	defaultLogger.info(`setupVoiceCapture ${channelId}`);
	const vc = client.channels.resolve(channelId);
	// join vc -> wait for speaking -> capture stream -> pipe mixer
	vc.join().then(connection => {
		// play startup sound
		connection.play(soundPath).on('speaking', (value) => {
			if(value) return;
			defaultLogger.info(`[Capture] Join ${vc.name}`);
			connection.on("speaking", (user, speaking) => {
				debugLogger.info(`[Capture] speaking:${speaking.bitfield} from:${user.username}`);
				if (speaking.bitfield > 0) {
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
		});
	}).catch(errorLogger);
	return vc;
};
// disconnect voicechat
const leaveVoiceChannel = (vc) => {
	if(vc && vc.name) {
		defaultLogger.info(`Leave ${vc.name}`);
		vc.leave();
	}
};
//////////////////////////////////////////////////////////////////////
// voicechat controll
let voicechannels = [];
const run = () => {
	voicechannels =
		mixers.map((mixer, index) => {
			const client = clients[index];
			const channelId = voiceChannelIds[index];
			// こことinputPipesをconfigurableにすれば便利だけど需要がないので実装していない
			if (index === 0) {
				// setup lobby mixing
				return setupVoiceMixing(mixer, client, channelId, config.debug, config.startupSoundPath);
			} else {
				// setup voicechat capture
				return setupVoiceCapture(mixer, client, channelId, config.mixerInputSetting, config.startupSoundPath);
			}
		});
}

// ikanokaiwaくんstop
const stop = () => {
	voicechannels.forEach(vc => {
		leaveVoiceChannel(vc);
	});
	voicechannels = [];
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
	"!kaiwa leave": stop,
	"!ikanokaiwa stop": stop,
	"!ikanokaiwa leave": stop,
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
	c.on('ready', () => defaultLogger.info(`bot ${index} ready`));
	c.login(tokens[index]);
	defaultLogger.info(`bot ${index} login`);
});
