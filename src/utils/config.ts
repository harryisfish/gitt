import * as fs from 'fs';
import * as path from 'path';
import { simpleGit } from 'simple-git';

export interface GittConfig {
    mainBranch?: string;
}

const CONFIG_FILE_NAME = '.gitt';

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
        return JSON.parse(content);
    } catch (error) {
        return {};
    }
}

/**
 * Write to the .gitt configuration file.
 */
export async function writeConfigFile(config: GittConfig): Promise<void> {
    const root = await getProjectRoot();
    const configPath = path.join(root, CONFIG_FILE_NAME);

    // Read existing config to merge
    const currentConfig = await readConfigFile();
    const newConfig = { ...currentConfig, ...config };

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}
