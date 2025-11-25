import * as fs from 'fs';
import * as path from 'path';
import { simpleGit } from 'simple-git';
import { minimatch } from 'minimatch';

export interface GittConfig {
    mainBranch?: string;
    ignoreBranches?: string[];
    staleDays?: number;
}

const CONFIG_FILE_NAME = '.gitt';

/**
 * Validate configuration values.
 */
function validateConfig(config: any): GittConfig {
    const validated: GittConfig = {};

    // Validate mainBranch
    if (config.mainBranch !== undefined) {
        if (typeof config.mainBranch !== 'string' || config.mainBranch.trim() === '') {
            throw new Error('Invalid config: mainBranch must be a non-empty string');
        }
        validated.mainBranch = config.mainBranch.trim();
    }

    // Validate ignoreBranches
    if (config.ignoreBranches !== undefined) {
        if (!Array.isArray(config.ignoreBranches)) {
            throw new Error('Invalid config: ignoreBranches must be an array');
        }

        const validPatterns: string[] = [];
        for (const pattern of config.ignoreBranches) {
            if (typeof pattern !== 'string' || pattern.trim() === '') {
                throw new Error('Invalid config: ignoreBranches must contain non-empty strings');
            }
            // Test if it's a valid glob pattern by trying to use it
            try {
                minimatch('test', pattern);
                validPatterns.push(pattern);
            } catch (e) {
                throw new Error(`Invalid config: "${pattern}" is not a valid glob pattern`);
            }
        }
        validated.ignoreBranches = validPatterns;
    }

    // Validate staleDays
    if (config.staleDays !== undefined) {
        if (typeof config.staleDays !== 'number' || config.staleDays < 1 || config.staleDays > 365 || !Number.isInteger(config.staleDays)) {
            throw new Error('Invalid config: staleDays must be an integer between 1 and 365');
        }
        validated.staleDays = config.staleDays;
    }

    return validated;
}

/**
 * Get the project root directory (where .git is located).
 */
export async function getProjectRoot(): Promise<string> {
    const git = simpleGit();
    try {
        const root = await git.revparse(['--show-toplevel']);
        return root.trim();
    } catch (e) {
        return process.cwd();
    }
}

/**
 * Read the .gitt configuration file.
 */
export async function readConfigFile(): Promise<GittConfig> {
    try {
        const root = await getProjectRoot();
        const configPath = path.join(root, CONFIG_FILE_NAME);

        if (!fs.existsSync(configPath)) {
            return {};
        }

        const content = fs.readFileSync(configPath, 'utf-8');
        const parsedConfig = JSON.parse(content);
        return validateConfig(parsedConfig);
    } catch (error) {
        // If validation fails, throw the error instead of returning empty config
        if (error instanceof Error && error.message.startsWith('Invalid config:')) {
            throw error;
        }
        // For other errors (file read, JSON parse), return empty config
        return {};
    }
}

/**
 * Write to the .gitt configuration file.
 */
export async function writeConfigFile(config: GittConfig): Promise<void> {
    // Validate new config before writing
    const validatedConfig = validateConfig(config);

    const root = await getProjectRoot();
    const configPath = path.join(root, CONFIG_FILE_NAME);

    // Read existing config to merge
    const currentConfig = await readConfigFile();
    const newConfig = { ...currentConfig, ...validatedConfig };

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}
