import { confirm } from '@inquirer/prompts';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { printSuccess, GitError } from '../errors';

const packageJson = require('../../package.json');

interface ReleaseInfo {
    version: string;
    changelog: string;
    publishedAt: string;
}

/**
 * Detect which package manager is being used
 */
function detectPackageManager(): 'npm' | 'pnpm' | 'yarn' | null {
    try {
        // Check if installed globally with pnpm
        try {
            execSync('pnpm list -g --depth=0', { encoding: 'utf8', stdio: 'pipe' });
            const output = execSync('pnpm list -g --depth=0', { encoding: 'utf8' });
            if (output.includes(packageJson.name)) {
                return 'pnpm';
            }
        } catch (e) {
            // Not installed with pnpm or pnpm not available
        }

        // Check if installed globally with yarn
        try {
            const output = execSync('yarn global list', { encoding: 'utf8', stdio: 'pipe' });
            if (output.includes(packageJson.name)) {
                return 'yarn';
            }
        } catch (e) {
            // Not installed with yarn or yarn not available
        }

        // Check if installed globally with npm
        try {
            const output = execSync('npm list -g --depth=0', { encoding: 'utf8', stdio: 'pipe' });
            if (output.includes(packageJson.name)) {
                return 'npm';
            }
        } catch (e) {
            // Not installed with npm
        }

        // Fallback: check for lock files in project directory
        const projectRoot = process.cwd();
        if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
            return 'yarn';
        }
        if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
            return 'npm';
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Fetch latest release information from GitHub
 */
async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
    try {
        const response = await fetch(
            'https://api.github.com/repos/harryisfish/gitt/releases/latest',
            {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'gitt-cli'
                }
            }
        );

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            version: data.tag_name.replace(/^v/, ''), // Remove 'v' prefix if present
            changelog: data.body || 'No changelog available',
            publishedAt: data.published_at
        };
    } catch (error) {
        return null;
    }
}

/**
 * Format changelog for display
 */
function formatChangelog(changelog: string): string {
    // Split by lines and format
    const lines = changelog.split('\n');
    const formatted: string[] = [];

    for (const line of lines) {
        if (line.trim() === '') continue;

        // Format headers
        if (line.startsWith('## ')) {
            formatted.push(chalk.bold.cyan(line));
        } else if (line.startsWith('### ')) {
            formatted.push(chalk.bold.yellow(line));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            formatted.push(chalk.gray('  ' + line));
        } else {
            formatted.push(line);
        }
    }

    return formatted.join('\n');
}

/**
 * Check for updates using update-notifier
 */
async function checkForUpdate(): Promise<{ current: string; latest: string; type: string } | null> {
    try {
        const updateNotifier = await import('update-notifier').then(m => m.default);
        const notifier = updateNotifier({
            pkg: packageJson,
            updateCheckInterval: 0 // Force check
        });

        if (notifier.update) {
            return {
                current: notifier.update.current,
                latest: notifier.update.latest,
                type: notifier.update.type
            };
        }

        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Execute upgrade command
 */
function executeUpgrade(packageManager: string, packageName: string): void {
    console.log(chalk.cyan('\nUpgrading...'));

    try {
        let command: string;

        switch (packageManager) {
            case 'pnpm':
                command = `pnpm add -g ${packageName}@latest`;
                break;
            case 'yarn':
                command = `yarn global add ${packageName}@latest`;
                break;
            case 'npm':
            default:
                command = `npm install -g ${packageName}@latest`;
                break;
        }

        console.log(chalk.gray(`Running: ${command}\n`));

        execSync(command, {
            stdio: 'inherit',
            encoding: 'utf8'
        });

        console.log('');
        printSuccess('Upgrade completed successfully!');
        console.log(chalk.gray('Run "gitt --version" to verify the new version.\n'));
    } catch (error) {
        throw new GitError(
            'Upgrade failed. Please try upgrading manually:\n' +
            `  ${packageManager} install -g ${packageName}@latest`,
            error instanceof Error ? error : undefined
        );
    }
}

/**
 * Main upgrade command handler
 */
export async function upgradeCommand(): Promise<void> {
    try {
        console.log(chalk.cyan('🔍 Checking for updates...\n'));

        // Check for updates
        const updateInfo = await checkForUpdate();

        if (!updateInfo) {
            printSuccess('You are already on the latest version! 🎉');
            console.log(chalk.gray(`Current version: ${packageJson.version}\n`));
            return;
        }

        const { current, latest, type } = updateInfo;

        // Display version comparison
        console.log(chalk.bold('Version Information:'));
        console.log(`  Current: ${chalk.yellow(current)}`);
        console.log(`  Latest:  ${chalk.green(latest)}`);
        console.log(`  Type:    ${chalk.gray(type)}\n`);

        // Fetch and display changelog
        console.log(chalk.bold('📝 Fetching release notes...\n'));
        const releaseInfo = await fetchLatestRelease();

        if (releaseInfo && releaseInfo.changelog) {
            console.log(chalk.bold('What\'s New:\n'));
            console.log(formatChangelog(releaseInfo.changelog));
            console.log('');
        }

        // Detect package manager
        const packageManager = detectPackageManager();

        if (!packageManager) {
            console.log(chalk.yellow('⚠ Could not detect package manager.'));
            console.log(chalk.gray('Please upgrade manually using one of these commands:\n'));
            console.log(chalk.gray(`  npm install -g ${packageJson.name}@latest`));
            console.log(chalk.gray(`  pnpm add -g ${packageJson.name}@latest`));
            console.log(chalk.gray(`  yarn global add ${packageJson.name}@latest\n`));
            return;
        }

        console.log(chalk.gray(`Package manager detected: ${packageManager}\n`));

        // Ask for confirmation
        const shouldUpgrade = await confirm({
            message: `Would you like to upgrade to v${latest}?`,
            default: true
        });

        if (!shouldUpgrade) {
            console.log(chalk.gray('\nUpgrade cancelled.\n'));
            return;
        }

        // Execute upgrade
        executeUpgrade(packageManager, packageJson.name);

    } catch (error) {
        if (error instanceof GitError) {
            throw error;
        }
        throw new GitError(
            'Failed to check for updates. Please check your internet connection.',
            error instanceof Error ? error : undefined
        );
    }
}
