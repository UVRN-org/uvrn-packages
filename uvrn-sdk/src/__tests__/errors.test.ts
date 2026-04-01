/**
 * Unit tests for error classes
 */

import {
  DeltaEngineError,
  ValidationError,
  ExecutionError,
  NetworkError,
  ConfigurationError
} from '../errors';

describe('Error Classes', () => {
  describe('DeltaEngineError', () => {
    test('creates error with message', () => {
      const error = new DeltaEngineError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('DeltaEngineError');
    });

    test('is instance of Error', () => {
      const error = new DeltaEngineError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DeltaEngineError);
    });

    test('can be caught as Error', () => {
      try {
        throw new DeltaEngineError('Test');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Test');
      }
    });
  });

  describe('ValidationError', () => {
    test('creates error with message and errors array', () => {
      const errors = [
        { field: 'bundleId', message: 'required' },
        { field: 'claim', message: 'required' }
      ];

      const error = new ValidationError('Validation failed', errors);

      expect(error.message).toBe('Validation failed');
      expect(error.name).toBe('ValidationError');
      expect(error.errors).toEqual(errors);
    });

    test('works with empty errors array', () => {
      const error = new ValidationError('Failed');
      expect(error.errors).toEqual([]);
    });

    test('is instance of DeltaEngineError', () => {
      const error = new ValidationError('Test');
      expect(error).toBeInstanceOf(DeltaEngineError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('ExecutionError', () => {
    test('creates error with message, exitCode, and stderr', () => {
      const error = new ExecutionError('Failed', 1, 'stderr output');

      expect(error.message).toBe('Failed');
      expect(error.name).toBe('ExecutionError');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('stderr output');
    });

    test('works without optional parameters', () => {
      const error = new ExecutionError('Failed');
      expect(error.exitCode).toBeUndefined();
      expect(error.stderr).toBeUndefined();
    });

    test('is instance of DeltaEngineError', () => {
      const error = new ExecutionError('Test');
      expect(error).toBeInstanceOf(DeltaEngineError);
      expect(error).toBeInstanceOf(ExecutionError);
    });
  });

  describe('NetworkError', () => {
    test('creates error with message, statusCode, and response', () => {
      const response = { error: 'Server error' };
      const error = new NetworkError('HTTP 500', 500, response);

      expect(error.message).toBe('HTTP 500');
      expect(error.name).toBe('NetworkError');
      expect(error.statusCode).toBe(500);
      expect(error.response).toEqual(response);
    });

    test('works without optional parameters', () => {
      const error = new NetworkError('Network failed');
      expect(error.statusCode).toBeUndefined();
      expect(error.response).toBeUndefined();
    });

    test('is instance of DeltaEngineError', () => {
      const error = new NetworkError('Test');
      expect(error).toBeInstanceOf(DeltaEngineError);
      expect(error).toBeInstanceOf(NetworkError);
    });
  });

  describe('ConfigurationError', () => {
    test('creates error with message', () => {
      const error = new ConfigurationError('Invalid config');
      expect(error.message).toBe('Invalid config');
      expect(error.name).toBe('ConfigurationError');
    });

    test('is instance of DeltaEngineError', () => {
      const error = new ConfigurationError('Test');
      expect(error).toBeInstanceOf(DeltaEngineError);
      expect(error).toBeInstanceOf(ConfigurationError);
    });
  });

  describe('Error hierarchy', () => {
    test('all errors are instances of DeltaEngineError', () => {
      const errors = [
        new ValidationError('test'),
        new ExecutionError('test'),
        new NetworkError('test'),
        new ConfigurationError('test')
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(DeltaEngineError);
        expect(error).toBeInstanceOf(Error);
      });
    });

    test('can catch specific error types', () => {
      try {
        throw new ValidationError('test', [{ field: 'test', message: 'error' }]);
      } catch (error) {
        if (error instanceof ValidationError) {
          expect(error.errors).toHaveLength(1);
        } else {
          fail('Should have caught ValidationError');
        }
      }
    });

    test('can catch as base DeltaEngineError', () => {
      const errors = [
        new ValidationError('test'),
        new ExecutionError('test'),
        new NetworkError('test')
      ];

      errors.forEach(error => {
        try {
          throw error;
        } catch (caught) {
          if (caught instanceof DeltaEngineError) {
            expect(caught.message).toBe('test');
          } else {
            fail('Should have caught as DeltaEngineError');
          }
        }
      });
    });
  });
});
