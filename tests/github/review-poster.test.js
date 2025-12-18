/**
 * Tests for ReviewPoster
 */

const ReviewPoster = require('../../src/github/review-poster');

describe('ReviewPoster', () => {
  let mockClient;
  let poster;

  beforeEach(() => {
    mockClient = {
      request: jest.fn()
    };
    poster = new ReviewPoster(mockClient);
  });

  describe('postInlineComments', () => {
    test('should post comments via batch when successful', async () => {
      const comments = [
        { path: 'file.js', line: 10, body: 'Comment 1', side: 'RIGHT' },
        { path: 'file.js', line: 20, body: 'Comment 2', side: 'RIGHT' }
      ];

      mockClient.request.mockResolvedValueOnce({ data: {} });

      const result = await poster.postInlineComments('owner', 'repo', 123, comments);

      expect(result.posted).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockClient.request).toHaveBeenCalledTimes(1);
      expect(mockClient.request).toHaveBeenCalledWith(
        'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
          pull_number: 123,
          event: 'COMMENT',
          comments
        })
      );
    });

    test('should fallback to individual posts on batch validation error', async () => {
      const comments = [
        { path: 'file.js', line: 10, body: 'Valid comment', side: 'RIGHT' },
        { path: 'file.js', line: 999, body: 'Invalid line', side: 'RIGHT' }
      ];

      // First call (batch) fails with 422
      mockClient.request.mockRejectedValueOnce({
        status: 422,
        statusCode: 422,
        message: 'Validation Failed'
      });

      // Second call (individual valid comment) succeeds
      mockClient.request.mockResolvedValueOnce({ data: {} });

      // Third call (individual invalid comment) fails with 422
      mockClient.request.mockRejectedValueOnce({
        status: 422,
        statusCode: 422,
        message: 'Validation Failed'
      });

      const result = await poster.postInlineComments('owner', 'repo', 123, comments);

      expect(result.posted).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockClient.request).toHaveBeenCalledTimes(3); // 1 batch + 2 individual
    });

    test('should handle empty comments array', async () => {
      const result = await poster.postInlineComments('owner', 'repo', 123, []);

      expect(result.posted).toBe(0);
      expect(result.skipped).toBe(0);
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    test('should throw on non-validation errors after retries', async () => {
      const comments = [
        { path: 'file.js', line: 10, body: 'Comment', side: 'RIGHT' }
      ];

      // Mock all retries to fail with 500 error
      const error = new Error('Internal Server Error');
      error.status = 500;
      mockClient.request.mockRejectedValue(error);

      // Mock sleep to avoid delays
      poster.sleep = jest.fn().mockResolvedValue();

      await expect(
        poster.postInlineComments('owner', 'repo', 123, comments)
      ).rejects.toThrow('Internal Server Error');
      
      // Should have tried 3 times (initial + 2 retries)
      expect(mockClient.request.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('retryWithBackoff', () => {
    test('should retry on transient errors', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Temporary error');
          error.status = 500;
          throw error;
        }
        return 'success';
      });

      const result = await poster.retryWithBackoff(fn, 3);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('should not retry on 422 validation errors', async () => {
      const fn = jest.fn(async () => {
        const error = new Error('Validation Failed');
        error.status = 422;
        throw error;
      });

      await expect(poster.retryWithBackoff(fn, 3)).rejects.toThrow('Validation Failed');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should handle rate limiting with backoff', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Rate limited');
          error.status = 429;
          throw error;
        }
        return 'success';
      });

      // Mock sleep to avoid actual delays in tests
      poster.sleep = jest.fn().mockResolvedValue();

      const result = await poster.retryWithBackoff(fn, 3);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(poster.sleep).toHaveBeenCalled();
    });
  });

  describe('calculateBackoffDelay', () => {
    test('should use Retry-After header when available', () => {
      const error = {
        response: {
          headers: {
            'retry-after': '60'
          }
        }
      };

      const delay = poster.calculateBackoffDelay(1, error);
      expect(delay).toBe(60000); // 60 seconds in ms
    });

    test('should use X-RateLimit-Reset header when available', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 120; // 2 minutes from now
      const error = {
        response: {
          headers: {
            'x-ratelimit-reset': futureTime.toString()
          }
        }
      };

      const delay = poster.calculateBackoffDelay(1, error);
      expect(delay).toBeGreaterThan(100000); // Should be around 120 seconds
      expect(delay).toBeLessThan(130000);
    });

    test('should use exponential backoff when no headers', () => {
      const error = { response: { headers: {} } };

      const delay1 = poster.calculateBackoffDelay(1, error);
      const delay2 = poster.calculateBackoffDelay(2, error);
      const delay3 = poster.calculateBackoffDelay(3, error);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });
  });
});

