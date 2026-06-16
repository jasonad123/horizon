'use strict';

var express = require('express');
var pinoHttp = require('pino-http');
var compression = require('compression');
var cookieParser = require('cookie-parser');
var path = require('path');
var config = require('./environment');
var helmet = require('helmet');
var logger = require('./logger');

module.exports = function (app) {
	var env = app.get('env');

	if (process.env.TRUST_PROXY) {
		app.set(
			'trust proxy',
			process.env.TRUST_PROXY === 'true' ? true : parseInt(process.env.TRUST_PROXY, 10)
		);
	}

	app.use(
		helmet({
			contentSecurityPolicy: false
		})
	);

	if (env !== 'production') {
		app.use(function (req, res, next) {
			var allowedOrigins = config.security.cors.allowedOrigins;
			var origin = req.headers.origin;
			if (allowedOrigins.indexOf(origin) > -1) {
				res.setHeader('Access-Control-Allow-Origin', origin);
			}
			res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
			res.header('Access-Control-Allow-Headers', 'Content-Type');
			if (req.method === 'OPTIONS') return res.sendStatus(200);
			next();
		});
	}

	app.use(compression());
	app.use(express.urlencoded({ extended: false, limit: '1mb' }));
	app.use(express.json({ limit: '1mb' }));
	app.use(cookieParser());

	app.use(
		express.static(path.join(config.root, 'svelte-app/build/client'), {
			maxAge: env === 'production' ? '1d' : 0,
			etag: true,
			lastModified: true,
			index: false,
			setHeaders: function (res, filepath) {
				if (filepath.includes('/_app/immutable/')) {
					res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
				} else if (filepath.match(/\.(woff2|woff|ttf|eot)$/)) {
					res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
				} else if (filepath.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
					res.setHeader('Cache-Control', 'public, max-age=86400');
				}
			}
		})
	);

	var pinoHttpOptions = {
		level: logger.baseConfig.level,
		timestamp: logger.baseConfig.timestamp,
		base: logger.baseConfig.base,
		redact: logger.baseConfig.redact,
		serializers: logger.baseConfig.serializers,
		customLogLevel: function (req, res, err) {
			if (res.statusCode >= 500 || err) return 'error';
			if (res.statusCode >= 400) return 'warn';
			if (res.statusCode >= 300) return 'silent';
			return 'info';
		},
		customSuccessMessage: function (req, res) {
			var duration = res.responseTime !== undefined ? res.responseTime + 'ms' : '';
			return req.method + ' ' + req.url + ' ' + res.statusCode + (duration ? ' ' + duration : '');
		},
		customAttributeKeys: {
			req: 'request',
			res: 'response',
			err: 'error',
			responseTime: 'duration_ms'
		},
		autoLogging: {
			ignore: function (req) {
				return (
					req.path === '/health' ||
					req.path === '/favicon.ico' ||
					req.path.startsWith('/_app/immutable/')
				);
			}
		}
	};

	if (logger.isDevelopment) {
		pinoHttpOptions.transport = {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'SYS:standard',
				ignore: 'pid,hostname',
				levelFirst: true
			}
		};
	}

	app.use(pinoHttp(pinoHttpOptions));

	app.use(function (err, req, res, next) {
		if (req.log) req.log.error({ err: err }, 'Unhandled request error');
		else logger.error({ err: err }, 'Unhandled request error');
		res.status(err.status || 500).json({ error: 'Server error' });
	});
};
