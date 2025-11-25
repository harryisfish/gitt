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

        it('should be throwable', () => {
            expect(() => {
                throw new GitError('Test error');
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
