#!/usr/bin/env node

import { simpleGit } from 'simple-git';
import { GitError, UserCancelError, handleError, printSuccess, printError } from './errors';
import { cleanDeletedBranches } from './commands/clean';

const git = simpleGit();

// 处理 Ctrl+C 和其他终止信号
process.on('SIGINT', () => {
    throw new UserCancelError('\nOperation cancelled');
});

process.on('SIGTERM', () => {
    throw new UserCancelError('\nProgram terminated');
});

// 初始化 Git 仓库
async function initGitRepo() {
    try {
        await git.init();
        printSuccess('Git repository initialized successfully');
    } catch (error) {
        throw new GitError('Failed to initialize Git repository');
    }
}

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

function printHelp() {
    console.log(`
Usage: gitt [command] [options]

Commands:
  (default)              Clean up local branches that have been deleted on remote
  set-main <branch>      Set the main branch for the current project
  ignore <pattern>       Add a branch pattern to the ignore list (e.g., "release/*")

Options:
  -i, --interactive      Interactive mode: Select branches to delete
  -d, --dry-run          Dry run: Show what would be deleted without deleting
  -h, --help             Show this help message

Examples:
  gitt                   # Auto-clean deleted branches
  gitt -i                # Select branches to delete interactively
  gitt -d                # Preview deletion
  gitt ignore "temp/*"   # Ignore branches matching "temp/*"
  gitt set-main master   # Set main branch to 'master'
`);
}

async function main() {
    try {
        const args = process.argv.slice(2);
        const command = args[0];

        // Check for help command
        if (args.includes('-h') || args.includes('--help')) {
            printHelp();
            process.exit(0);
        }

        // 检查 Git 仓库
        await checkGitRepo();

        if (command === 'set-main') {
            const branch = args[1];
            if (!branch) {
                throw new Error('Please specify a branch name');
            }
            await import('./commands/config').then(m => m.configMainBranch(branch));
        } else if (command === 'ignore') {
            const pattern = args[1];
            if (!pattern) {
                throw new Error('Please specify a branch pattern to ignore');
            }
            await import('./commands/config').then(m => m.configIgnoreBranch(pattern));
        } else {
            // Parse options
            const isInteractive = args.includes('-i') || args.includes('--interactive');
            const isDryRun = args.includes('-d') || args.includes('--dry-run');

            // 默认执行清理操作
            await cleanDeletedBranches({ interactive: isInteractive, dryRun: isDryRun });
        }

        // 退出程序
        process.exit(0);
    } catch (error) {
        handleError(error);
        process.exit(1);
    }
}

// 启动程序
main().catch(handleError);