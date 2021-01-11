module.exports = {
	env: {
		es2021: true,
		node: true
	},
	extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: 12,
		sourceType: "module"
	},
	plugins: ["@typescript-eslint"],
	rules: {
		"no-var": "warn",
		"prefer-const": "warn",
		"@typescript-eslint/explicit-function-return-type": "warn",
		"@typescript-eslint/no-non-null-assertion": "error",
		"@typescript-eslint/no-unused-vars": [
			"warn",
			{
				vars: "all",
				args: "after-used",
				varsIgnorePattern: "^_",
				argsIgnorePattern: "^_"
			}
		],
		indent: ["off"], // Conflicts with Prettier.
		"no-mixed-spaces-and-tabs": ["off"], // Conflicts with Prettier.
		"linebreak-style": ["error", "unix"],
		quotes: ["error", "double"],
		semi: ["error", "always"]
	}
};
