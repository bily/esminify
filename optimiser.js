var util = require('util'),
	fs = require('fs'),
	walker = require('./walker').walker,
	map = require('./walker').map;

function HOP(a, b) {
	return Object.hasOwnProperty.call(a, b);
}

function constant(node, yes, no) {
	var notConstant = {};

	function evaluate(n) {
		var l, r;

		switch (n.type) {
		case 'Literal':
			return n.value;
			break;
		case 'BinaryExpression':
		case 'LogicalExpression':
			l = evaluate(n.left);
			r = evaluate(n.right);

			switch (n.operator) {
				case '&&': return l && r;
				case '||': return l || r;
				case '+':  return l +  r;
				case '-':  return l -  r;
				case '*':  return l *  r;
				case '/':  return l /  r;
				case '%':  return l %  r;
				case '&':  return l &  r;
				case '|':  return l |  r;
				case '^':  return l ^  r;
			}
			break;
		case 'UnaryExpression':
			l = evaluate(n.argument);

			switch (n.operator) {
			case '-': return -l;
			case '+': return +l;
			case '~': return ~l;
			case '!': return !l;
			case 'typeof': return typeof l;
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

function Identifier(name, scope, declared) {
	this.name = name;
	this.scope = scope;
	this.declared = !!declared;

	++Identifier.sequence;
}

Identifier.prototype = {
	toString: function () {
		return this.name;
	},
	name: null,
	declared: false,
	scope: null
};

Identifier.sequence = 0;

function scope(parent) {
	var that = {},
		names = {};

	if (parent) {
		that.parent = parent;
	}

	that.declare = function (name) {
		if (name in names) {
			return names[name];
		}

		return names[name] = new Identifier(name, that, true);
	};
	that.find = function (name) {
		if (!(name in names)) {
			if (that.parent) {
				return that.parent.find(name);
			}

			return names[name] = new Identifier(name, this, false);
		} else {
			return names[name];
		}
	};

	return that;
}

scope.current = null,
scope.enter = function (spec) {
	if (spec) {
		scope.current = spec;
	} else {
		scope.current = scope(scope.current);
	}
};

scope.leave =  function () {
	scope.current = scope.current.parent;
};

function addScope(ast) {
	var walk = walker();

	function identifier(name) {
		return {
			type: 'Identifier',
			name: name
		};
	}

	function functionDecl() {
		var result = {
			type: this.type,
			id: this.id ? identifier(scope.current.declare(this.id.name)) : null
		}

		scope.enter();

		result.params = this.params.reduce(function (a, b) {
			a.push(identifier(scope.current.declare(b.name)));
			return a;
		}, []);

		result.body = walk(this.body);

		scope.leave();

		return result;
	}

	return walk(ast, {
		Identifier: function () {
			return {
				type: this.type,
				name: scope.current.find(this.name)
			};
		},
		VariableDeclarator: function () {
			return {
				type: this.type,
				id: identifier(scope.current.declare(this.id.name)),
				init: this.init ? walk(this.init) : null
			};
		},
		FunctionExpression: functionDecl,
		FunctionDeclaration: functionDecl,
		MemberExpression: function () {
			return {
				type: this.type,
				object: walk(this.object),
				property: this.property.type === 'Identifier' ? this.property : walk(this.property),
				computed: this.computed
			};
		},
		Property: function () {
			return {
				type: this.type,
				key: this.key.type === 'Identifier' ? this.key : walk(this.key),
				value: walk(this.value)
			};
		}
	});
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
	currentScope = null;

	scope.enter();
	tree = addScope(tree);
	tree = foldConstants(tree);

	return walker()(tree, {
		Identifier: function () {
			return {
				type: this.type,
				name: String(this.name)
			};
		}
	});
};
