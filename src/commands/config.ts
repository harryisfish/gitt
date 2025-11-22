import { setMainBranch } from '../utils/git';
import { printSuccess, handleError } from '../errors';

export async function configMainBranch(branch: string) {
    try {
        await setMainBranch(branch);
        printSuccess(`Successfully set main branch to '${branch}'`);
    } catch (error) {
        handleError(error);
    }
}
