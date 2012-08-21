var util = require('util'),
	fs = require('fs'),
	codegen = require('./external/escodegen'),
	walker = require('./walker').walker,
	map = require('./walker').map;

function HOP(a, b) {
	return Object.hasOwnProperty.call(a, b);
}

function finalize(tree) {
	return walker()(tree, {
		Literal: function () {
			return typeof this.value === 'boolean' ? {
				type: 'UnaryExpression',
				operator: '!',
				argument: {
					type: 'Literal',
					value: this.value ? 0 : 1
				}
			} : this;
		}
	});
}

function shortest(list) {
	function gen(tree) {
		return codegen.generate(tree, {
			format: {
				compact: true,
				quotes: 'auto',
				semicolons: false,
				renumber: true,
				parentheses: false,
				escapeless: true
			}
		});
	}

	list.sort(function (a, b) {
		var a1 = gen(a),
			b1 = gen(b);

		return a1.length === b1.length ? 0 : a1.length < b1.length ? -1 : 1;
	});

	return list[0];
}

function negate(expr) {
	var basis = {
			type: 'UnaryExpression',
			operator: '!',
			argument: expr
		},
		switchMap = {
			'==': '!=',
			'!=': '==',
			'===': '!==',
			'!==': '===',
			'<': '>=',
			'>': '<=',
			'<=': '>',
			'>=': '<'
		};

	switch (expr.type) {
	case 'UnaryExpression':
		return expr.operator === '!' ? expr.argument : basis;
	case 'ConditionalExpression':
		return shortest([basis, {
			type: 'ConditionalExpression',
			test: expr.test,
			consequent: negate(expr.consequent),
			alternate: negate(expr.alternate)
		}]);
	case 'BinaryExpression':
		if (switchMap[expr.operator]) {
			return {
				type: expr.type,
				operator: switchMap[expr.operator],
				left: expr.left,
				right: expr.right
			};
		}

		return basis;
	case 'LogicalExpression':
		return shortest([basis, {
			type: expr.type,
			operator: expr.operator === '&&' ? '||' : '&&',
			left: negate(expr.left),
			right: negate(expr.right)
		}]);
	case 'Literal':
		return {
			type: 'Literal',
			value: !expr.value
		};
	}

	return basis;
}

function constant(node, yes, no) {
	var notConstant = {};

	function evaluate(n) {
		var l, r;

		switch (n.type) {
		case 'Literal':
			return n.value;
		case 'BinaryExpression':
		case 'LogicalExpression':
			l = evaluate(n.left);
			r = evaluate(n.right);

			switch (n.operator) {
			case '&&':
				return l && r;
			case '||':
				return l || r;
			case '+':
				return l +  r;
			case '-':
				return l -  r;
			case '*':
				return l *  r;
			case '/':
				return l /  r;
			case '%':
				return l %  r;
			case '&':
				return l &  r;
			case '|':
				return l |  r;
			case '^':
				return l ^  r;
			}
			break;
		case 'UnaryExpression':
			l = evaluate(n.argument);

			switch (n.operator) {
			case '-':
				return -l;
			case '+':
				return +l;
			case '~':
				return ~l;
			case '!':
				return !l;
			case 'typeof':
				return typeof l;
			case 'void':
				return void l;
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

function identifier(name, scope, declared) {
	return {
		type: 'Identifier',
		name: String(name),
		scope: scope,
		declared: !!declared,
		types: [],
		seq: ++identifier.sequence
	};
}

identifier.sequence = 0;

function scope(parent) {
	var that = {},
		names = {};

	if (parent) {
		that.parent = parent;
	}

	that.declare = function (name) {
		if (HOP(names, name)) {
			return names[name];
		}

		return (names[name] = identifier(name, that, true));
	};
	that.find = function (name) {
		if (!HOP(names, name)) {
			if (that.parent) {
				return that.parent.find(name);
			}

			return (names[name] = identifier(name, this, false));
		}

		return names[name];
	};

	return that;
}

scope.current = null;
scope.enter = function (spec) {
	if (spec) {
		scope.current = spec;
	} else {
		scope.current = scope(scope.current);
	}
};

scope.leave = function () {
	scope.current = scope.current.parent;
};

function addScope(ast) {
	var walk = walker();

	function functionDecl() {
		var result = {
			type: this.type,
			id: this.id ? scope.current.declare(this.id.name) : null
		};

		scope.enter();

		result.params = this.params.reduce(function (a, b) {
			a.push(scope.current.declare(b.name));
			return a;
		}, []);

		result.body = walk(this.body);

		scope.leave();

		return result;
	}

	return walk(ast, {
		Identifier: function () {
			return scope.current.find(this.name);
		},
		VariableDeclarator: function () {
			return {
				type: this.type,
				id: scope.current.declare(this.id.name),
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
		},
		ContinueStatement: function () {
			return this;
		},
		BreakStatement: function () {
			return this;
		},
		LabeledStatement: function () {
			return {
				type: this.type,
				label: this.label,
				body: walk(this.body)
			};
		}
	});
}

function numberExpression(value) {
	if (!isFinite(value)) {
		return {
			type: 'BinaryExpression',
			operator: '/',
			left: {
				type: 'Literal',
				value: isNaN(value) ? 0 : 1
			},
			right: value < 0 ? {
				type: 'UnaryExpression',
				operator: '-',
				argument: {
					type: 'Literal',
					value: 0
				}
			} : {
				type: 'Literal',
				value: 0
			}
		};
	}

	if (value < 0) {
		return {
			type: 'UnaryExpression',
			operator: '-',
			argument: {
				type: 'Literal',
				value: -value
			}
		};
	}

	return {
		type: 'Literal',
		value: value
	};
}

function foldConstants(ast) {
	var walk = walker(),
		notConst = {};

	function optimise () {	
		return constant(this, function (value) {	
			return typeof value === 'number' ? numberExpression(value) : {
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
		UnaryExpression: optimise,
		Literal: function () {
			if (typeof this.value === 'number') {
				return numberExpression(this.value);
			}

			return this;
		}
	});
}

function expression(node) {
	if (node.type === 'ExpressionStatement') {
		return node.expression;
	}

	if (node.type === 'BlockStatement' && node.body.length === 1) {
		return expression(node.body[0]);
	}
}

function transform(ast) {
	var walk = walker();

	return walk(ast, {
		IfStatement: function () {
			var t = walk(this.test),
				c = walk(this.consequent),
				a = this.alternate ? walk(this.alternate) : null,
				type = this.type,
				l = expression(c),
				r = a ? expression(this.alternate) : null,
				options;

			return constant(t, function (value) {
				if (value) {
					return c;
				}

				if (a) {
					return a;
				}

				return {
					type: 'EmptyStatement'
				};
			}, function () {
				if (!l || (a && !r)) {
					options = [{
						type: type,
						test: t,
						consequent: c,
						alternate: a
					}];

					if (a) {
						options.push({
							type: type,
							test: negate(t),
							consequent: a,
							alternate: c
						});
					}

					return shortest(options);
				}

				return {
					type: 'ExpressionStatement',
					expression: a ? {
						type: 'ConditionalExpression',
						test: t,
						consequent: l,
						alternate: r
					} : {
						type: 'LogicalExpression',
						operator: '&&',
						left: t,
						right: l
					}
				};
			});
		},
		ConditionalExpression: function () {
			var t = walk(this.test),
				c = walk(this.consequent),
				a = walk(this.alternate);

			return constant(t, function (value) {
				return value ? c : a;
			}, function () {
				return shortest([{
					type: 'ConditionalExpression',
					test: t,
					consequent: c,
					alternate: a
				}, {
					type: 'ConditionalExpression',
					test: negate(t),
					consequent: a,
					alternate: c
				}]);
			});
		},
		BlockStatement: function () {
			var body = map(walk, this.body).reduce(function (body, stmt) {
				var prev;
				if (stmt.type === 'ExpressionStatement') {
					prev = body[body.length - 1];
					if (prev && prev.type === 'ExpressionStatement') {
						if (stmt.expression.type === 'SequenceExpression') {
							stmt.expression.expressions.forEach(function (v) {
								prev.expression.expressions.push(v);
							});
						} else {
							prev.expression.expressions.push(stmt.expression);
						}
					} else {
						body.push(stmt.expression.type === 'SequenceExpression' ? stmt : {
							type: 'ExpressionStatement',
							expression: {
								type: 'SequenceExpression',
								expressions: [stmt.expression]
							}
						});
					}
				} else if (stmt.type !== 'EmptyStatement') {
					body.push(stmt);
				}

				return body;
			}, []);

			if (body.length === 1) {
				return body[0];
			}

			if (body.length === 0) {
				return {
					type: 'EmptyStatement'
				};
			}

			return {
				type: this.type,
				body: body
			};
		}
	});
}

exports.optimise = function (tree) {
/*	var walk = walker();

	tree = walk(tree, {
		Literal: function () {
			return typeof this.value === 'boolean' ? {
				type: 'UnaryExpression',
				operator: '!',
				argument: {
					type: 'Literal',
					value: this.value ? 0 : 1
				}
			} : this;
		}
	});
*/
	currentScope = null;

	scope.enter();
	tree = addScope(tree);
	tree = foldConstants(tree);
	tree = transform(tree);

	return finalize(tree);
};
