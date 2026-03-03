/**
 * Utility functions
 */

/**
 * Add two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}

/**
 * Create a greeting message
 * @param {string} name - Name to greet
 * @returns {string} Greeting message
 */
function greeting(name) {
  return `Hello, ${name}!`;
}

// Export functions
module.exports = { add, greeting };

// Simple test cases
function runTests() {
  let passed = 0;
  let failed = 0;

  // Test add function
  console.log('Testing add function:');
  
  // Test case 1: add(1, 2) should return 3
  if (add(1, 2) === 3) {
    console.log('  ✓ add(1, 2) = 3');
    passed++;
  } else {
    console.log('  ✗ add(1, 2) failed');
    failed++;
  }

  // Test case 2: add(-1, 1) should return 0
  if (add(-1, 1) === 0) {
    console.log('  ✓ add(-1, 1) = 0');
    passed++;
  } else {
    console.log('  ✗ add(-1, 1) failed');
    failed++;
  }

  // Test case 3: add(0, 0) should return 0
  if (add(0, 0) === 0) {
    console.log('  ✓ add(0, 0) = 0');
    passed++;
  } else {
    console.log('  ✗ add(0, 0) failed');
    failed++;
  }

  // Test greeting function
  console.log('\nTesting greeting function:');
  
  // Test case 4: greeting('World') should return 'Hello, World!'
  if (greeting('World') === 'Hello, World!') {
    console.log('  ✓ greeting("World") = "Hello, World!"');
    passed++;
  } else {
    console.log('  ✗ greeting("World") failed');
    failed++;
  }

  // Test case 5: greeting('Alice') should return 'Hello, Alice!'
  if (greeting('Alice') === 'Hello, Alice!') {
    console.log('  ✓ greeting("Alice") = "Hello, Alice!"');
    passed++;
  } else {
    console.log('  ✗ greeting("Alice") failed');
    failed++;
  }

  // Test case 6: greeting('') should return 'Hello, !'
  if (greeting('') === 'Hello, !') {
    console.log('  ✓ greeting("") = "Hello, !"');
    passed++;
  } else {
    console.log('  ✗ greeting("") failed');
    failed++;
  }

  // Summary
  console.log(`\nTest Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
