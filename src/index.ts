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

async function main() {
    try {
        // 检查 Git 仓库
        await checkGitRepo();
        
        // 执行清理操作
        await cleanDeletedBranches();
        
        // 退出程序
        process.exit(0);
    } catch (error) {
        handleError(error);
        process.exit(1);
    }
}

// 启动程序
main().catch(handleError);