// Mock UUID implementation for testing
let counter = 0;

const v4 = () => {
  counter++;
  return `test-uuid-${counter.toString().padStart(4, '0')}-4000-4000-8000-123456789abc`;
};

module.exports = { v4 };