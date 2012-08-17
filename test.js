#!/usr/bin/env node
var optimise = require('./optimiser').optimise,
	esprima = require('esprima'),
	codegen = require('escodegen'),
	util = require('util'),
	fs = require('fs');

fs.readFile('./jquery-1.7.2.js', function (err, data) {
	if (err) {
		throw err;
	}

	var tree = esprima.parse(data);

	tree = optimise(tree);

	console.log(codegen.generate(tree, {
		format: {
			compact: true,
			quotes: 'auto',
			semicolons: false,
			renumber: true,
			parentheses: false,
			escapeless: true
		}
	}));
});
