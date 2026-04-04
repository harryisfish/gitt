use serde::Deserialize;
use std::sync::mpsc;
use std::thread;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const REPO: &str = "harryisfish/gitt";

#[derive(Deserialize)]
struct Release {
    tag_name: String,
}

pub struct UpdateChecker {
    rx: mpsc::Receiver<Option<String>>,
}

impl UpdateChecker {
    pub fn spawn() -> Self {
        let (tx, rx) = mpsc::channel();

        thread::spawn(move || {
            let result = check_latest();
            let _ = tx.send(result);
        });

        Self { rx }
    }

    /// Non-blocking: returns Some(new_version) if update available
    pub fn try_recv(&self) -> Option<Option<String>> {
        self.rx.try_recv().ok()
    }
}

fn check_latest() -> Option<String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let mut response = ureq::get(&url)
        .header("User-Agent", "gitt")
        .call()
        .ok()?;

    let release: Release = response.body_mut().read_json().ok()?;
    let latest = release.tag_name.trim_start_matches('v');
    let current = CURRENT_VERSION;

    if version_newer(latest, current) {
        Some(latest.to_string())
    } else {
        None
    }
}

fn version_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };
    let l = parse(latest);
    let c = parse(current);
    l > c
}
