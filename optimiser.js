var esprima = require('esprima'),
	codegen = require('escodegen'),
	util = require('util'),
	fs = require('fs'),
	walker = require('./walker').walker,
	map = require('./walker').map;

function constant(node, yes, no) {
	var notConstant = {};

	function evaluate(n) {
		switch (n.type) {
		case 'Literal':
			return n.value;
			break;
		case 'BinaryExpression':
		case 'LogicalExpression':
			switch (n.operator) {
				case '&&': return evaluate(n.left) && evaluate(n.right);
				case '||': return evaluate(n.left) || evaluate(n.right);
				case '+':  return evaluate(n.left) + evaluate(n.right);
				case '-':  return evaluate(n.left) - evaluate(n.right);
				case '*':  return evaluate(n.left) * evaluate(n.right);
				case '/':  return evaluate(n.left) / evaluate(n.right);
				case '%':  return evaluate(n.left) % evaluate(n.right);
				case '&':  return evaluate(n.left) & evaluate(n.right);
				case '|':  return evaluate(n.left) | evaluate(n.right);
				case '^':  return evaluate(n.left) ^ evaluate(n.right);
			}
			break;
		case 'UnaryExpression':
			switch (n.operator) {
			case '-': return -evaluate(n.argument);
			case '+': return +evaluate(n.argument);
			case '~': return ~evaluate(n.argument);
			case '!': return !evaluate(n.argument);
			case 'typeof': return typeof evaluate(n.argument);
			}
			break;
		}
	
		throw notConstant;	
	}

	try {
		return yes.call(node, evaluate(node));
	} catch (e) {
		if (e === notConstant) {
			return no.call(node);
		}
		
		throw e;
	}
}


function foldConstants(ast) {
	var walk = walker(),
		notConst = {};
	
	function optimise () {	
		return constant(this, function (value) {	
			if (typeof value === 'number') {
				if (value < 0) {
					return {
						type: 'UnaryExpression',
						operator: '-',
						argument: {	
							type: 'Literal',
							value: -value
						}
					};
				} else if (isNaN(value)) {
					return {
						type: 'BinaryExpression',
						operator: '/',
						left: {
							type: 'Literal',
							value: 0
						},
						right: {
							type: 'Literal',
							value: 0
						}
					};
				}
			}
			
			return {
				type: 'Literal',
				value: value
			};
		}, function () {
			var result = {
				type: this.type,
				operator: this.operator
			};
			
			if (this.type === 'UnaryExpression') {
				result.argument = walk(this.argument);
			} else {
				result.left = walk(this.left);
				result.right = walk(this.right);
			}
			
			return result;
		});
	}
	
	return walk(ast, {
		BinaryExpression: optimise,
		LogicalExpression: optimise,
		UnaryExpression: optimise
	});
}

exports.optimise = function (tree) {
	tree = foldConstants(tree);
	
	return tree;
};

