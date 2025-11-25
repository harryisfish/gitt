import chalk from 'chalk';

// Custom error types
export class GitError extends Error {
    cause?: Error;

    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'GitError';
        this.cause = cause;

        // Preserve stack trace from the cause if available
        if (cause?.stack) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}

export class UserCancelError extends Error {
    constructor(message: string = 'Operation cancelled') {
        super(message);
        this.name = 'UserCancelError';
    }
}

// Unified error handling function
export function handleError(error: unknown): never {
    if (error instanceof UserCancelError) {
        console.log(error.message);
        process.exit(0);
    }

    if (error instanceof GitError) {
        console.error(chalk.red('Error:'), error.message);
        // In development mode, show full stack trace
        if (process.env.DEBUG || process.env.VERBOSE) {
            console.error(chalk.gray(error.stack));
        }
        process.exit(1);
    }

    if (error instanceof Error) {
        console.error(chalk.red('Program error:'), error.message);
        // In development mode, show full stack trace
        if (process.env.DEBUG || process.env.VERBOSE) {
            console.error(chalk.gray(error.stack));
        }
        process.exit(1);
    }

    console.error(chalk.red('Unknown error occurred'));
    process.exit(1);
}

// Success message handler
export function printSuccess(message: string): void {
    console.log(chalk.green('✓'), message);
}

// Error message handler
export function printError(message: string): void {
    console.error(chalk.red(message));
} 