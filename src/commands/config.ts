import { setMainBranch } from '../utils/git';
import { printSuccess, handleError } from '../errors';
import { readConfigFile, writeConfigFile } from '../utils/config';

export async function configMainBranch(branch: string) {
    try {
        await setMainBranch(branch);
        printSuccess(`Successfully set main branch to '${branch}'`);
    } catch (error) {
        handleError(error);
    }
}

export async function configIgnoreBranch(pattern: string) {
    try {
        const config = await readConfigFile();
        const ignoreBranches = config.ignoreBranches || [];

        if (!ignoreBranches.includes(pattern)) {
            ignoreBranches.push(pattern);
            await writeConfigFile({ ignoreBranches });
            printSuccess(`Successfully added '${pattern}' to ignore list`);
        } else {
            printSuccess(`'${pattern}' is already in the ignore list`);
        }
    } catch (error) {
        handleError(error);
    }
}
