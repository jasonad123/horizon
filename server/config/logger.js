'use strict';

const pino = require('pino');
const pkg = require('../../package.json');

const isDevelopment = process.env.NODE_ENV !== 'production';

const loggerConfig = {
	level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
	timestamp: pino.stdTimeFunctions.isoTime,
	base: {
		env: process.env.NODE_ENV || 'development',
		version: pkg.version
	},
	redact: {
		paths: [
			'apiKey',
			'*.apiKey',
			'req.headers.apikey',
			'req.headers.authorization',
			'req.headers.cookie',
			'req.cookies'
		],
		remove: true
	},
	serializers: {
		err: pino.stdSerializers.err,
		req: pino.stdSerializers.req,
		res: pino.stdSerializers.res
	}
};

if (isDevelopment) {
	loggerConfig.transport = {
		target: 'pino-pretty',
		options: {
			colorize: true,
			translateTime: 'SYS:standard',
			ignore: 'pid,hostname',
			levelFirst: true
		}
	};
}

const logger = pino(loggerConfig);

const baseConfig = {
	level: loggerConfig.level,
	timestamp: loggerConfig.timestamp,
	base: loggerConfig.base,
	redact: loggerConfig.redact,
	serializers: loggerConfig.serializers
};

module.exports = logger;
module.exports.baseConfig = baseConfig;
module.exports.isDevelopment = isDevelopment;
