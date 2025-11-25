#!/usr/bin/env node

import { Command } from 'commander';
import { simpleGit } from 'simple-git';
import { GitError, UserCancelError, handleError } from './errors';
import { cleanDeletedBranches } from './commands/clean';

const git = simpleGit();
const packageJson = require('../package.json');

// 处理 Ctrl+C 和其他终止信号
process.on('SIGINT', () => {
    throw new UserCancelError('\nOperation cancelled');
});

process.on('SIGTERM', () => {
    throw new UserCancelError('\nProgram terminated');
});

// 检查当前目录是否是 Git 仓库
async function checkGitRepo() {
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        throw new GitError('Current directory is not a Git repository');
    }

    // 检查是否有远程仓库配置
    const remotes = await git.getRemotes();
    if (remotes.length === 0) {
        throw new GitError('Current Git repository has no remote configured');
    }

    // 检查是否能访问远程仓库
    try {
        await git.fetch(['--dry-run']);
    } catch (error) {
        throw new GitError('Cannot access remote repository, please check network connection or repository permissions');
    }
}

async function main() {
    try {
        // Check for updates before parsing commands
        try {
            // Use eval to prevent TypeScript from transpiling dynamic import to require()
            const { default: updateNotifier } = await (eval('import("update-notifier")') as Promise<any>);
            updateNotifier({ pkg: packageJson }).notify();
        } catch (e) {
            // Ignore update check errors
        }

        const program = new Command();

        program
            .name('gitt')
            .description('A CLI tool for Git branch management')
            .version(packageJson.version, '-v, --version', 'Show version number');

        // Default command: clean deleted branches
        program
            .option('-i, --interactive', 'Interactive mode: Select branches to delete')
            .option('-d, --dry-run', 'Dry run: Show what would be deleted without deleting')
            .option('--stale [days]', 'Find stale branches (default: 90 days)', '90')
            .action(async (options) => {
                await checkGitRepo();

                const staleDays = options.stale === true ? 90 : parseInt(options.stale, 10);
                const isStale = options.stale !== undefined;

                await cleanDeletedBranches({
                    interactive: options.interactive || false,
                    dryRun: options.dryRun || false,
                    stale: isStale,
                    staleDays: staleDays
                });
            });

        // set-main command
        program
            .command('set-main <branch>')
            .description('Set the main branch for the current project')
            .action(async (branch: string) => {
                await checkGitRepo();
                await import('./commands/config').then(m => m.configMainBranch(branch));
            });

        // ignore command
        program
            .command('ignore <pattern>')
            .description('Add a branch pattern to the ignore list (e.g., "release/*")')
            .action(async (pattern: string) => {
                await checkGitRepo();
                await import('./commands/config').then(m => m.configIgnoreBranch(pattern));
            });

        // Add examples to help
        program.addHelpText('after', `
Examples:
  $ gitt                   # Auto-clean deleted branches
  $ gitt -i                # Select branches to delete interactively
  $ gitt -d                # Preview deletion
  $ gitt --stale           # Find branches inactive for 90+ days
  $ gitt --stale 30        # Find branches inactive for 30+ days
  $ gitt ignore "temp/*"   # Ignore branches matching "temp/*"
  $ gitt set-main master   # Set main branch to 'master'
`);

        await program.parseAsync(process.argv);
    } catch (error) {
        handleError(error);
    }
}

// 启动程序
main();