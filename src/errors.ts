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

// 错误消息颜色
const ERROR_COLOR = '\x1b[31m';
const SUCCESS_COLOR = '\x1b[32m';
const RESET_COLOR = '\x1b[0m';

// 统一错误处理函数
export function handleError(error: unknown): never {
    if (error instanceof UserCancelError) {
        console.log(error.message);
        process.exit(0);
    }

    if (error instanceof GitError) {
        console.error(`${ERROR_COLOR}Error: ${RESET_COLOR}${error.message}`);
        process.exit(1);
    }

    if (error instanceof Error) {
        console.error(`${ERROR_COLOR}Program error: ${RESET_COLOR}${error.message}`);
        process.exit(1);
    }

    console.error(`${ERROR_COLOR}Unknown error occurred${RESET_COLOR}`);
    process.exit(1);
}

// 成功消息处理
export function printSuccess(message: string): void {
    console.log(`${SUCCESS_COLOR}✓ ${message}${RESET_COLOR}`);
}

// 错误消息处理
export function printError(message: string): void {
    console.error(`${ERROR_COLOR}${message}${RESET_COLOR}`);
} 