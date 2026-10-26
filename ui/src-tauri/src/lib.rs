use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;
struct Backend(Mutex<Option<Child>>);

fn find_repo_root() -> Option<std::path::PathBuf> {
    let exe = std::env::current_exe().ok()?;
    for ancestor in exe.ancestors() {
        let candidate = ancestor.join("core").join("main.py");
        if candidate.exists() {
            return Some(ancestor.to_path_buf());
        }
    }
    let home = dirs::home_dir()?;
    let repo = home.join("repositories").join("kitsune");
    if repo.join("core").join("main.py").exists() {
        return Some(repo);
    }
    None
}

fn start_backend(repo: &std::path::Path) -> Option<Child> {
    let venv_python = repo.join(".venv").join("bin").join("python");
    if !venv_python.exists() {
        log::warn!("venv python not found at {:?}", venv_python);
        return None;
    }

    let child = Command::new(&venv_python)
        .args([
            "-m", "uvicorn",
            "core.main:app",
            "--host", "127.0.0.1",
            "--port", "9848",
        ])
        .current_dir(repo)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .ok()?;

    log::info!("Backend started (pid {})", child.id());
    Some(child)
}

fn wait_for_backend(max_secs: u32) -> bool {
    for _ in 0..max_secs * 10 {
        if backend_reachable() {
            return true;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    false
}

fn backend_reachable() -> bool {
    std::net::TcpStream::connect_timeout(
        &"127.0.0.1:9848".parse().unwrap(),
        std::time::Duration::from_millis(200),
    )
    .is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if !backend_reachable() {
                if let Some(repo) = find_repo_root() {
                    if let Some(ollama) = which::which("ollama").ok() {
                        let _ = Command::new(ollama)
                            .arg("serve")
                            .stdout(std::process::Stdio::null())
                            .stderr(std::process::Stdio::null())
                            .spawn();
                    }
                    let child = start_backend(&repo);
                    app.manage(Backend(Mutex::new(child)));
                } else {
                    log::warn!("Could not find kitsune repo root");
                    app.manage(Backend(Mutex::new(None)));
                }
            } else {
                log::info!("Backend already running on :9848");
                app.manage(Backend(Mutex::new(None)));
            }

            wait_for_backend(10);

            // Navigate to the backend so everything is same-origin
            if let Some(window) = app.get_webview_window("main") {
                let url: tauri::Url = "http://127.0.0.1:9848".parse().unwrap();
                let _ = window.navigate(url);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app.try_state::<Backend>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            log::info!("Stopping backend (pid {})", child.id());
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
