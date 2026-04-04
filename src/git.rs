use anyhow::Result;
use git2::{Repository, StatusOptions, StatusShow};


#[derive(Debug, Clone)]
pub struct FileStatus {
    pub path: String,
    pub staged: StagedStatus,
    pub unstaged: UnstagedStatus,
}

#[derive(Debug, Clone, PartialEq)]
pub enum StagedStatus {
    None,
    New,
    Modified,
    Deleted,
    Renamed,
    Typechange,
}

#[derive(Debug, Clone, PartialEq)]
pub enum UnstagedStatus {
    None,
    Modified,
    Deleted,
    Typechange,
    Untracked,
}

#[derive(Debug, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub time: String,
}

#[derive(Debug)]
pub struct GitState {
    pub files: Vec<FileStatus>,
    pub branches: Vec<BranchInfo>,
    pub log: Vec<CommitInfo>,
    pub head_branch: String,
    pub repo_name: String,
}

impl GitState {
    pub fn staged_count(&self) -> usize {
        self.files
            .iter()
            .filter(|f| f.staged != StagedStatus::None)
            .count()
    }

    pub fn unstaged_count(&self) -> usize {
        self.files
            .iter()
            .filter(|f| f.unstaged != UnstagedStatus::None && f.unstaged != UnstagedStatus::Untracked)
            .count()
    }

    pub fn untracked_count(&self) -> usize {
        self.files
            .iter()
            .filter(|f| f.unstaged == UnstagedStatus::Untracked)
            .count()
    }
}

pub fn load_git_state() -> Result<GitState> {
    let repo = Repository::discover(".")?;
    let repo_name = repo
        .workdir()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let files = get_status(&repo)?;
    let branches = get_branches(&repo)?;
    let log = get_log(&repo)?;
    let head_branch = get_head_branch(&repo);

    Ok(GitState {
        files,
        branches,
        log,
        head_branch,
        repo_name,
    })
}

fn get_status(repo: &Repository) -> Result<Vec<FileStatus>> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("???").to_string();
        let status = entry.status();

        let staged = if status.is_index_new() {
            StagedStatus::New
        } else if status.is_index_modified() {
            StagedStatus::Modified
        } else if status.is_index_deleted() {
            StagedStatus::Deleted
        } else if status.is_index_renamed() {
            StagedStatus::Renamed
        } else if status.is_index_typechange() {
            StagedStatus::Typechange
        } else {
            StagedStatus::None
        };

        let unstaged = if status.is_wt_new() {
            UnstagedStatus::Untracked
        } else if status.is_wt_modified() {
            UnstagedStatus::Modified
        } else if status.is_wt_deleted() {
            UnstagedStatus::Deleted
        } else if status.is_wt_typechange() {
            UnstagedStatus::Typechange
        } else {
            UnstagedStatus::None
        };

        files.push(FileStatus {
            path,
            staged,
            unstaged,
        });
    }

    Ok(files)
}

fn get_branches(repo: &Repository) -> Result<Vec<BranchInfo>> {
    let mut branches = Vec::new();
    let head_ref = repo.head().ok();
    let head_name = head_ref
        .as_ref()
        .and_then(|r| r.shorthand().map(|s| s.to_string()));

    for branch_result in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch
            .name()?
            .unwrap_or("???")
            .to_string();
        let is_head = head_name.as_deref() == Some(&name);

        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        let (ahead, behind) = if let (Some(local_oid), Ok(upstream_branch)) =
            (branch.get().target(), branch.upstream())
        {
            if let Some(remote_oid) = upstream_branch.get().target() {
                repo.graph_ahead_behind(local_oid, remote_oid)
                    .unwrap_or((0, 0))
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        branches.push(BranchInfo {
            name,
            is_head,
            upstream,
            ahead,
            behind,
        });
    }

    // Sort: current branch first, then alphabetically
    branches.sort_by(|a, b| b.is_head.cmp(&a.is_head).then(a.name.cmp(&b.name)));

    Ok(branches)
}

fn get_log(repo: &Repository) -> Result<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut log = Vec::new();
    for (i, oid_result) in revwalk.enumerate() {
        if i >= 50 {
            break;
        }
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;
        let time = commit.time();
        let timestamp = time.seconds();

        log.push(CommitInfo {
            hash: format!("{:.7}", oid),
            message: commit
                .summary()
                .unwrap_or("")
                .to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            time: format_relative_time(timestamp),
        });
    }

    Ok(log)
}

fn get_head_branch(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|r| r.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "HEAD (detached)".to_string())
}

fn format_relative_time(timestamp: i64) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let diff = now - timestamp;

    if diff < 60 {
        "just now".to_string()
    } else if diff < 3600 {
        format!("{}m ago", diff / 60)
    } else if diff < 86400 {
        format!("{}h ago", diff / 3600)
    } else if diff < 604800 {
        format!("{}d ago", diff / 86400)
    } else if diff < 2592000 {
        format!("{}w ago", diff / 604800)
    } else {
        format!("{}mo ago", diff / 2592000)
    }
}
