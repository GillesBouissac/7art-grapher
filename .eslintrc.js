module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "plugins": [
        "jsdoc"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:jsdoc/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "semi": ["error", "always"],
        "quotes": ["error", "double"]
    }
};
