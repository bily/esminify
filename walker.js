function map(func, what) {
	return what.reduce(function (a, b) {
		a.push(func(b));
		return a;
	}, []);
}

function walker() {
	var walk, specific = {}, walkers = {
		ArrayExpression: function () {
			return {
				type: this.type,
				elements: map(walk, this.elements)
			};
		},
		AssignmentExpression: function () {
			return {
				type: this.type,
				operator: this.operator,
				left: walk(this.left),
				right: walk(this.right)
			};
		},
		BinaryExpression: function () {
			return {
				type: this.type,
				operator: this.operator,
				left: walk(this.left),
				right: walk(this.right)
			};
		},
		BlockStatement: function () {
			return {
				type: this.type,
				body: map(walk, this.body)
			};
		},
		BreakStatement: function () {
			return {
				type: this.type,
				label: this.label ? walk(this.label) : null
			};
		},
		CallExpression: function () {
			return {
				type: this.type,
				callee: walk(this.callee),
				arguments: map(walk, this.arguments)
			};
		},
		CatchClause: function () {
			return {
				type: this.type,
				param: walk(this.param),
				guard: this.guard ? walk(this.guard) : null,
				body: walk(this.body)
			};
		},
		ConditionalExpression: function () {
			return {
				type: this.type,
				test: walk(this.test),
				consequent: walk(this.consequent),
				alternate: walk(this.alternate)
			};
		},
		ContinueStatement: function () {
			return {
				type: this.type,
				label: this.label ? walk(this.label) : null
			};
		},
		DebuggerStatement: function () {
			return {
				type: this.type
			};
		},
		DoWhileStatement: function () {
			return {
				type: this.type,
				body: walk(this.body),
				test: walk(this.test)
			};
		},
		EmptyStatement: function () {
			return {
				type: this.type
			};
		},
		ExpressionStatement: function () {
			return {
				type: this.type,
				expression: walk(this.expression)
			};
		},
		ForInStatement: function () {
			return {
				type: this.type,
				left: walk(this.left),
				right: walk(this.right),
				body: walk(this.body),
				each: this.each
			};
		},
		ForStatement: function () {
			return {
				type: this.type,
				init: this.init ? walk(this.init) : null,
				test: this.test ? walk(this.test) : null,
				update: this.update ? walk(this.update) : null,
				body: walk(this.body)
			};
		},
		FunctionDeclaration: function () {
			return {
				type: this.type,
				id: this.id ? walk(this.id) : null,
				params: map(walk, this.params),
				body: walk(this.body)
			};
		},
		FunctionExpression: function () {
			return {
				type: this.type,
				id: this.id ? walk(this.id) : null,
				params: map(walk, this.params),
				body: walk(this.body)
			};
		},
		Identifier: function () {
			return {
				type: this.type,
				name: this.name
			};
		},
		IfStatement: function () {
			return {
				type: this.type,
				test: walk(this.test),
				consequent: walk(this.consequent),
				alternate: this.alternate ? walk(this.alternate) : null
			};
		},
		LabeledStatement: function () {
			return {
				type: this.type,
				label: walk(this.label),
				body: walk(this.body)
			};
		},
		Literal: function () {
			return {
				type: this.type,
				value: this.value
			};
		},
		LogicalExpression: function () {
			return {
				type: this.type,
				operator: this.operator,
				left: walk(this.left),
				right: walk(this.right)
			};
		},
		MemberExpression: function () {
			var property = walk(this.property);

			return {
				type: this.type,
				object: walk(this.object),
				property: property,
				computed: property.type !== 'Identifier'
			};
		},
		NewExpression: function () {
			return {
				type: this.type,
				callee: walk(this.callee),
				arguments: map(walk, this.arguments)
			};
		},
		ObjectExpression: function () {
			return {
				type: this.type,
				properties: map(walk, this.properties)
			};
		},
		Program: function () {
			return {
				type: this.type,
				body: map(walk, this.body)
			};
		},
		Property: function () {
			return {
				type: this.type,
				key: walk(this.key),
				value: walk(this.value)
			};
		},
		ReturnStatement: function () {
			return {
				type: this.type,
				argument: this.argument ? walk(this.argument) : null
			};
		},
		SequenceExpression: function () {
			return {
				type: this.type,
				expressions: map(walk, this.expressions)
			};
		},
		SwitchCase: function () {
			return {
				type: this.type,
				test: walk(this.test),
				consequent: map(walk, this.consequent)
			};
		},
		SwitchStatement: function () {
			return {
				type: this.type,
				discriminant: walk(this.discriminant),
				cases: map(walk, this.cases)
			};
		},
		ThisExpression: function () {
			return {
				type: this.type
			};
		},
		ThrowStatement: function () {
			return {
				type: this.type,
				argument: walk(this.argument)
			};
		},
		TryStatement: function () {
			return {
				type: this.type,
				block: walk(this.block),
				handlers: map(walk, this.handlers),
				finalizer: this.finalizer ? walk(this.finalizer) : null
			};
		},
		UnaryExpression: function () {
			return {
				type: this.type,
				operator: this.operator,
				argument: walk(this.argument)
			};
		},
		UpdateExpression: function () {
			return {
				type: this.type,
				operator: this.operator,
				argument: walk(this.argument),
				prefix: this.prefix
			};
		},
		VariableDeclaration: function () {
			return {
				type: this.type,
				kind: this.kind,
				declarations: map(walk, this.declarations)
			};
		},
		VariableDeclarator: function () {
			return {
				type: this.type,
				id: walk(this.id),
				init: this.init ? walk(this.init) : null
			};
		},
		WhileStatement: function () {
			return {
				type: this.type,
				test: walk(this.test),
				body: walk(this.body)
			};
		},
		WithStatement: function () {
			return {
				type: this.type,
				object: walk(this.object),
				body: walk(this.body)
			};
		}
	};

	return walk = function (node, spec) {
		var retain, current;

		if (spec) {
			retain = specific;
			specific = spec;
		}

		current = specific[node.type] || walkers[node.type];

		if (!current) {
			console.dir(node);
			throw node.type + ' not supported';
		}

		try {
			return current.call(node) || node;
		} finally {
			if (retain) {
				specific = retain;
			}
		}
	};
}

exports.walker = walker;
exports.map = map;
