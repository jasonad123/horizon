'use strict';

var express = require('express');
var config = require('./config/environment');
var logger = require('./config/logger');

var app = express();
var server = require('http').createServer(app);

require('./config/express')(app);
require('./routes')(app);

function startServer() {
	server.once('error', function (err) {
		if (err.code === 'EAFNOSUPPORT' || err.code === 'EADDRNOTAVAIL') {
			logger.warn({ err: err, attempted_ip: config.ip }, 'IPv6 not available - falling back to IPv4');
			config.ip = '0.0.0.0';
			server.listen(config.port, config.ip, function () {
				logger.info({ port: config.port, ip: config.ip }, 'Express server started (IPv4 fallback)');
			});
		} else {
			logger.fatal({ err: err }, 'Server failed to start');
			process.exit(1);
		}
	});

	server.listen(config.port, config.ip, function () {
		logger.info({ port: config.port, ip: config.ip, env: app.get('env') }, 'Express server started');
	});
}

startServer();

process.on('uncaughtException', function (err) {
	logger.fatal({ err: err }, 'Uncaught exception - exiting');
	process.exit(1);
});

process.on('unhandledRejection', function (reason) {
	logger.error({ reason: reason }, 'Unhandled promise rejection');
});

function gracefulShutdown(signal) {
	logger.info({ signal: signal }, 'Shutdown signal received');
	server.close(function () {
		logger.info({ port: config.port }, 'HTTP server closed');
		process.exit(0);
	});
	setTimeout(function () {
		logger.error('Forcing shutdown after timeout');
		process.exit(1);
	}, 10000);
}

process.on('SIGTERM', function () { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function () { gracefulShutdown('SIGINT'); });

exports = module.exports = app;
