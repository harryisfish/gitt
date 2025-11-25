import { describe, it, expect } from 'vitest';
import { GitError, UserCancelError } from '../src/errors';

describe('Custom Error Classes', () => {
    describe('GitError', () => {
        it('should create GitError with message', () => {
            const error = new GitError('Test git error');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(GitError);
            expect(error.message).toBe('Test git error');
            expect(error.name).toBe('GitError');
        });

        it('should create GitError without cause', () => {
            const error = new GitError('Test error');
            expect(error.cause).toBeUndefined();
        });

        it('should create GitError with cause', () => {
            const originalError = new Error('Original error');
            const error = new GitError('Wrapped error', originalError);
            expect(error.cause).toBe(originalError);
        });

        it('should preserve stack trace from cause', () => {
            const originalError = new Error('Original error');
            const error = new GitError('Wrapped error', originalError);
            expect(error.stack).toContain('Wrapped error');
            expect(error.stack).toContain('Caused by:');
            expect(error.stack).toContain('Original error');
        });

        it('should be throwable', () => {
            expect(() => {
                throw new GitError('Test error');
            }).toThrow(GitError);
        });

        it('should be throwable with cause', () => {
            const originalError = new Error('Original');
            expect(() => {
                throw new GitError('Test error', originalError);
            }).toThrow(GitError);
        });
    });

    describe('UserCancelError', () => {
        it('should create UserCancelError with default message', () => {
            const error = new UserCancelError();
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(UserCancelError);
            expect(error.message).toBe('Operation cancelled');
            expect(error.name).toBe('UserCancelError');
        });

        it('should create UserCancelError with custom message', () => {
            const error = new UserCancelError('Custom cancellation');
            expect(error.message).toBe('Custom cancellation');
            expect(error.name).toBe('UserCancelError');
        });

        it('should be throwable', () => {
            expect(() => {
                throw new UserCancelError('User stopped');
            }).toThrow(UserCancelError);
        });
    });
});
