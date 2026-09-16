use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

/// Path passed on the command line (double-click on a .md file), consumed once by the UI.
struct LaunchFile(Mutex<Option<String>>);

fn file_arg(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .cloned()
}

#[tauri::command]
fn launch_file(state: State<LaunchFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch = file_arg(&std::env::args().collect::<Vec<_>>());

    tauri::Builder::default()
        // Must be registered first: a second launch (e.g. double-clicking another
        // file) forwards its arguments to the running window instead of opening a new one.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = file_arg(&args) {
                let _ = app.emit("open-file", path);
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(LaunchFile(Mutex::new(launch)))
        .invoke_handler(tauri::generate_handler![launch_file])
        .build(tauri::generate_context!())
        .expect("error while building MDnote")
        .run(|app, event| {
            // macOS delivers "open with" files as an event instead of an argument.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                if let Some(path) = urls.iter().filter_map(|u| u.to_file_path().ok()).next() {
                    let _ = app.emit("open-file", path.to_string_lossy().to_string());
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
