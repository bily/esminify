#!/usr/bin/env node
var optimise = require('./optimiser').optimise,
	esprima = require('./external/esprima'),
	codegen = require('./external/escodegen'),
	util = require('util'),
	fs = require('fs');

fs.readFile('./basis.js', function (err, data) {
	if (err) {
		throw err;
	}

	var tree = esprima.parse(data, {
		loc: true
	});

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
