/**
 * Main entry point - Demonstrates the usage of utility functions
 */

const { add, greeting } = require('./utils');

console.log('=== Test Project Demo ===\n');

// Demonstrate add function
console.log('1. Addition Examples:');
console.log(`   add(5, 3) = ${add(5, 3)}`);
console.log(`   add(10, 20) = ${add(10, 20)}`);
console.log(`   add(-5, 5) = ${add(-5, 5)}`);

// Demonstrate greeting function
console.log('\n2. Greeting Examples:');
console.log(`   greeting('World') = "${greeting('World')}"`);
console.log(`   greeting('Developer') = "${greeting('Developer')}"`);
console.log(`   greeting('Node.js') = "${greeting('Node.js')}"`);

console.log('\n=== Demo Complete ===');

// Export for testing
module.exports = { add, greeting };
