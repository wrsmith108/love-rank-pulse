/**
 * Utility functions for performance testing
 */

/**
 * Measure the execution time of a function
 * @param fn Function to measure
 * @param args Arguments to pass to the function
 * @returns Object containing the result and execution time in milliseconds
 */
export async function measureExecutionTime<T>(
  fn: (...args: any[]) => Promise<T> | T,
  ...args: any[]
): Promise<{ result: T; executionTime: number }> {
  const start = performance.now();
  const result = await fn(...args);
  const end = performance.now();
  const executionTime = end - start;
  
  return { result, executionTime };
}

/**
 * Measure page load time
 * @param url URL to load
 * @returns Promise that resolves to the load time in milliseconds
 */
export function measurePageLoadTime(url: string): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    
    // Create an iframe to load the page
    const iframe = document.createElement('iframe');
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    
    // Listen for load event
    iframe.onload = () => {
      const end = performance.now();
      const loadTime = end - start;
      
      // Clean up
      document.body.removeChild(iframe);
      
      resolve(loadTime);
    };
    
    // Add to document and set src to start loading
    document.body.appendChild(iframe);
    iframe.src = url;
  });
}

/**
 * Measure API response time
 * @param url API endpoint URL
 * @param method HTTP method
 * @param body Optional request body
 * @param headers Optional request headers
 * @returns Promise that resolves to an object containing the response and response time
 */
export async function measureApiResponseTime<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<{ response: T; responseTime: number }> {
  const start = performance.now();
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  const data = await response.json() as T;
  const end = performance.now();
  const responseTime = end - start;
  
  return { response: data, responseTime };
}

/**
 * Simulate concurrent users
 * @param concurrentUsers Number of concurrent users to simulate
 * @param action Function to execute for each user
 * @param delayBetweenUsers Delay between user actions in milliseconds
 * @returns Promise that resolves to an array of results
 */
export async function simulateConcurrentUsers<T>(
  concurrentUsers: number,
  action: (userId: number) => Promise<T>,
  delayBetweenUsers: number = 100
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < concurrentUsers; i++) {
    // Add a small delay between users to simulate realistic traffic
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenUsers));
    }
    
    // Execute the action in the background
    action(i).then(result => {
      results.push(result);
    });
  }
  
  // Wait for all actions to complete
  await new Promise(resolve => setTimeout(resolve, delayBetweenUsers * concurrentUsers));
  
  return results;
}

/**
 * Measure memory usage
 * @returns Memory usage in MB
 */
export function measureMemoryUsage(): number {
  // Chrome-specific API, need to use type assertion since it's not in the standard Performance interface
  const perf = performance as any;
  if (perf.memory && perf.memory.usedJSHeapSize) {
    return Math.round((perf.memory.usedJSHeapSize / 1024 / 1024) * 100) / 100;
  }
  
  return 0; // Not supported in this browser
}

/**
 * Format execution time with appropriate units
 * @param timeMs Time in milliseconds
 * @returns Formatted time string
 */
export function formatExecutionTime(timeMs: number): string {
  if (timeMs < 1) {
    return `${Math.round(timeMs * 1000)} μs`;
  } else if (timeMs < 1000) {
    return `${Math.round(timeMs)} ms`;
  } else {
    return `${Math.round(timeMs / 10) / 100} s`;
  }
}