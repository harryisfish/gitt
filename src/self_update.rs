use anyhow::{bail, Result};
use std::env;
use std::fs;
use std::io::Read;
use std::process::Command;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
const REPO: &str = "harryisfish/gitt";

pub fn run_update() -> Result<()> {
    println!("gitt v{CURRENT_VERSION}");
    println!("Checking for updates...");

    let (latest, download_url) = get_latest_release()?;
    let latest_clean = latest.trim_start_matches('v');

    if latest_clean == CURRENT_VERSION {
        println!("Already up to date.");
        return Ok(());
    }

    println!("New version available: v{latest_clean}");
    println!("Downloading...");

    let binary = download(&download_url)?;
    let current_exe = env::current_exe()?;

    // Replace binary: rename old, write new, remove old
    let backup = current_exe.with_extension("old");
    fs::rename(&current_exe, &backup)?;

    if let Err(e) = fs::write(&current_exe, &binary) {
        // Restore backup on failure
        let _ = fs::rename(&backup, &current_exe);
        bail!("Failed to write new binary: {e}");
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&current_exe, fs::Permissions::from_mode(0o755))?;
    }

    let _ = fs::remove_file(&backup);

    println!("Updated to v{latest_clean}!");
    Ok(())
}

fn get_latest_release() -> Result<(String, String)> {
    let target = get_target();

    // Try gh CLI first (authenticated, no rate limits)
    if let Ok(result) = get_release_via_gh(&target) {
        return Ok(result);
    }

    // Fallback to ureq
    get_release_via_api(&target)
}

fn get_release_via_gh(target: &str) -> Result<(String, String)> {
    let output = Command::new("gh")
        .args([
            "api",
            &format!("repos/{REPO}/releases/latest"),
            "--jq",
            &format!(
                r#""\(.tag_name)\n\(.assets[] | select(.name == "gitt-{target}.tar.gz") | .browser_download_url)"#
            ),
        ])
        .output()?;

    if !output.status.success() {
        bail!("gh api failed");
    }

    let stdout = String::from_utf8(output.stdout)?;
    let mut lines = stdout.lines();
    let tag = lines.next().unwrap_or("").to_string();
    let url = lines.next().unwrap_or("").to_string();

    if tag.is_empty() || url.is_empty() {
        bail!("Failed to parse gh output");
    }

    Ok((tag, url))
}

fn get_release_via_api(target: &str) -> Result<(String, String)> {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");
    let mut response = ureq::get(&url)
        .header("User-Agent", "gitt")
        .call()?;

    let json: serde_json::Value = response.body_mut().read_json()?;

    let tag = json["tag_name"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let asset_name = format!("gitt-{target}.tar.gz");
    let download_url = json["assets"]
        .as_array()
        .and_then(|assets| {
            assets.iter().find_map(|a| {
                if a["name"].as_str() == Some(&asset_name) {
                    a["browser_download_url"].as_str().map(|s| s.to_string())
                } else {
                    None
                }
            })
        })
        .unwrap_or_default();

    if tag.is_empty() || download_url.is_empty() {
        bail!("Failed to find release for {target}");
    }

    Ok((tag, download_url))
}

fn download(url: &str) -> Result<Vec<u8>> {
    // Try gh CLI first
    if let Ok(data) = download_via_gh(url) {
        return Ok(data);
    }

    // Fallback to ureq
    let mut response = ureq::get(url)
        .header("User-Agent", "gitt")
        .call()?;

    let mut tarball = Vec::new();
    response.body_mut().as_reader().read_to_end(&mut tarball)?;

    extract_binary(&tarball)
}

fn download_via_gh(url: &str) -> Result<Vec<u8>> {
    // Use curl via gh's auth or direct curl with -L for redirects
    let output = Command::new("curl")
        .args(["-fsSL", url])
        .output()?;

    if !output.status.success() {
        bail!("curl failed");
    }

    extract_binary(&output.stdout)
}

fn extract_binary(tarball: &[u8]) -> Result<Vec<u8>> {
    use flate2::read::GzDecoder;
    use std::io::Cursor;

    let decoder = GzDecoder::new(Cursor::new(tarball));
    let mut archive = tar::Archive::new(decoder);

    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?;
        if path.file_name().and_then(|n| n.to_str()) == Some("gitt") {
            let mut binary = Vec::new();
            entry.read_to_end(&mut binary)?;
            return Ok(binary);
        }
    }

    bail!("Binary not found in archive");
}

fn get_target() -> String {
    let os = if cfg!(target_os = "macos") {
        "apple-darwin"
    } else if cfg!(target_os = "linux") {
        "unknown-linux-gnu"
    } else {
        "unknown"
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "unknown"
    };

    format!("{arch}-{os}")
}
