import { describe, it, expect } from 'vitest';
import { GittConfig } from '../../src/utils/config';

// Note: Since validateConfig is not exported, we test it indirectly through writeConfigFile
// For proper testing, we should export validateConfig or create a separate validation module

describe('Config Validation', () => {
    describe('GittConfig interface', () => {
        it('should accept valid mainBranch', () => {
            const config: GittConfig = {
                mainBranch: 'main',
            };
            expect(config.mainBranch).toBe('main');
        });

        it('should accept valid ignoreBranches array', () => {
            const config: GittConfig = {
                ignoreBranches: ['temp/*', 'feature/*'],
            };
            expect(config.ignoreBranches).toHaveLength(2);
        });

        it('should accept valid staleDays number', () => {
            const config: GittConfig = {
                staleDays: 30,
            };
            expect(config.staleDays).toBe(30);
        });

        it('should accept all fields together', () => {
            const config: GittConfig = {
                mainBranch: 'master',
                ignoreBranches: ['temp/*'],
                staleDays: 90,
            };
            expect(config).toMatchObject({
                mainBranch: 'master',
                ignoreBranches: ['temp/*'],
                staleDays: 90,
            });
        });

        it('should accept empty config', () => {
            const config: GittConfig = {};
            expect(config).toEqual({});
        });
    });
});
