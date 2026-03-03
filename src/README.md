# Test Project

A simple demonstration project with utility functions.

## Features

- **add(a, b)**: Returns the sum of two numbers
  - Example: `add(2, 3)` returns `5`
  - Example: `add(-1, 1)` returns `0`

- **greeting(name)**: Returns a personalized greeting message
  - Example: `greeting('World')` returns `'Hello, World!'`
  - Example: `greeting('Alice')` returns `'Hello, Alice!'`

## Usage

### Running the demo

```bash
node src/index.js
```

### Running tests

```bash
node src/utils.js
```

### Using in your code

```javascript
const { add, greeting } = require('./utils');

console.log(add(5, 3));           // 8
console.log(greeting('User'));    // Hello, User!
```

## File Structure

```
src/
├── index.js    # Main entry point and demo
├── utils.js    # Utility functions with tests
└── README.md   # This file
```
