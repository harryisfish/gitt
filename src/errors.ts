import chalk from 'chalk';

// 自定义错误类型
export class GitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GitError';
    }
}

export class UserCancelError extends Error {
    constructor(message: string = 'Operation cancelled') {
        super(message);
        this.name = 'UserCancelError';
    }
}

// 统一错误处理函数
export function handleError(error: unknown): never {
    if (error instanceof UserCancelError) {
        console.log(error.message);
        process.exit(0);
    }

    if (error instanceof GitError) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
    }

    if (error instanceof Error) {
        console.error(chalk.red('Program error:'), error.message);
        process.exit(1);
    }

    console.error(chalk.red('Unknown error occurred'));
    process.exit(1);
}

// 成功消息处理
export function printSuccess(message: string): void {
    console.log(chalk.green('✓'), message);
}

// 错误消息处理
export function printError(message: string): void {
    console.error(chalk.red(message));
} 