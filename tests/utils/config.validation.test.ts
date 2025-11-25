import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { readConfigFile, writeConfigFile, getProjectRoot } from '../../src/utils/config';

// Mock modules
vi.mock('fs');
vi.mock('simple-git', () => ({
    simpleGit: () => ({
        revparse: vi.fn().mockResolvedValue('/mock/project/root'),
    }),
}));

describe('Config File Validation', () => {
    const mockRoot = '/mock/project/root';
    const configPath = path.join(mockRoot, '.gitt');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('readConfigFile', () => {
        it('should return empty config when file does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const config = await readConfigFile();
            expect(config).toEqual({});
        });

        it('should read and validate valid config', async () => {
            const validConfig = {
                mainBranch: 'main',
                ignoreBranches: ['temp/*', 'test/*'],
                staleDays: 90,
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(validConfig));

            const config = await readConfigFile();
            expect(config).toEqual(validConfig);
        });

        it('should throw error for invalid mainBranch', async () => {
            const invalidConfig = {
                mainBranch: '',
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

            await expect(readConfigFile()).rejects.toThrow('Invalid config: mainBranch must be a non-empty string');
        });

        it('should throw error for invalid staleDays (too small)', async () => {
            const invalidConfig = {
                staleDays: 0,
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

            await expect(readConfigFile()).rejects.toThrow('Invalid config: staleDays must be an integer between 1 and 365');
        });

        it('should throw error for invalid staleDays (too large)', async () => {
            const invalidConfig = {
                staleDays: 400,
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

            await expect(readConfigFile()).rejects.toThrow('Invalid config: staleDays must be an integer between 1 and 365');
        });

        it('should throw error for invalid staleDays (not integer)', async () => {
            const invalidConfig = {
                staleDays: 30.5,
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

            await expect(readConfigFile()).rejects.toThrow('Invalid config: staleDays must be an integer between 1 and 365');
        });

        it('should throw error for invalid ignoreBranches (not array)', async () => {
            const invalidConfig = {
                ignoreBranches: 'not-an-array',
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

            await expect(readConfigFile()).rejects.toThrow('Invalid config: ignoreBranches must be an array');
        });

        it('should throw error for invalid ignoreBranches (empty string)', async () => {
            const invalidConfig = {
                ignoreBranches: ['valid/*', ''],
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(invalidConfig));

            await expect(readConfigFile()).rejects.toThrow('Invalid config: ignoreBranches must contain non-empty strings');
        });

        it('should return empty config for malformed JSON', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('invalid json{');

            const config = await readConfigFile();
            expect(config).toEqual({});
        });

        it('should trim whitespace from mainBranch', async () => {
            const configWithWhitespace = {
                mainBranch: '  main  ',
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configWithWhitespace));

            const config = await readConfigFile();
            expect(config.mainBranch).toBe('main');
        });
    });

    describe('writeConfigFile', () => {
        it('should write valid config to file', async () => {
            const newConfig = {
                mainBranch: 'develop',
            };

            vi.mocked(fs.existsSync).mockReturnValue(false);
            vi.mocked(fs.writeFileSync).mockImplementation(() => {});

            await writeConfigFile(newConfig);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                configPath,
                JSON.stringify(newConfig, null, 2)
            );
        });

        it('should merge with existing config', async () => {
            const existingConfig = {
                ignoreBranches: ['temp/*'],
            };
            const newConfig = {
                mainBranch: 'main',
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
            vi.mocked(fs.writeFileSync).mockImplementation(() => {});

            await writeConfigFile(newConfig);

            const expectedConfig = {
                ignoreBranches: ['temp/*'],
                mainBranch: 'main',
            };

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                configPath,
                JSON.stringify(expectedConfig, null, 2)
            );
        });

        it('should throw error for invalid config', async () => {
            const invalidConfig = {
                staleDays: -1,
            };

            await expect(writeConfigFile(invalidConfig as any)).rejects.toThrow('Invalid config');
        });
    });

    describe('getProjectRoot', () => {
        it('should return git root directory', async () => {
            const root = await getProjectRoot();
            expect(root).toBe(mockRoot);
        });
    });
});
