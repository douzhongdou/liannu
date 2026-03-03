# Test Project

A simple utility library demonstrating basic JavaScript functions.

## Features

This project includes the following utility functions from `src/utils.js`:

- **`add(a, b)`** - Adds two numbers and returns the sum
  - Example: `add(2, 3)` returns `5`
  - Example: `add(-1, 1)` returns `0`

- **`greeting(name)`** - Returns a personalized greeting message
  - Example: `greeting('World')` returns `'Hello, World!'`
  - Example: `greeting('Alice')` returns `'Hello, Alice!'`

## Installation

```bash
git clone <repository-url>
cd <project-directory>
```

## Usage

### Importing the utilities

```javascript
const { add, greeting } = require('./src/utils');

// Use the add function
console.log(add(5, 3));        // Output: 8

// Use the greeting function
console.log(greeting('User')); // Output: Hello, User!
```

### Running tests

To run the built-in tests:

```bash
node src/utils.js
```

## Project Structure

```
.
├── README.md       # This file
├── src/
│   └── utils.js    # Utility functions with built-in tests
```

## License

MIT
