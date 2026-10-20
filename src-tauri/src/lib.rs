use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_fs::FsExt;

/// Path passed on the command line (double-click on a .md file), consumed once by the UI.
struct LaunchFile(Mutex<Option<String>>);

fn file_arg(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .cloned()
}

/// Grant the webview access to one path the user chose (file, or folder tree).
fn allow<R: Runtime>(app: &AppHandle<R>, path: &str, recursive: bool) {
    let scope = app.fs_scope();
    let r = if recursive { scope.allow_directory(path, true) } else { scope.allow_file(path) };
    if let Err(e) = r {
        eprintln!("fs scope: {e}");
    }
}

#[tauri::command]
fn allow_path(app: AppHandle, path: String, recursive: bool) {
    allow(&app, &path, recursive);
}

#[tauri::command]
fn launch_file(app: AppHandle, state: State<LaunchFile>) -> Option<String> {
    let path = state.0.lock().unwrap().take();
    if let Some(p) = &path {
        allow(&app, p, false);
    }
    path
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch = file_arg(&std::env::args().collect::<Vec<_>>());

    tauri::Builder::default()
        // Must be registered first: a second launch (e.g. double-clicking another
        // file) forwards its arguments to the running window instead of opening a new one.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = file_arg(&args) {
                allow(app, &path, false);
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
        .setup(|app| {
            // The window is built here (not in tauri.conf.json) so it can carry a navigation
            // guard: the main webview may only show the app itself. Links in documents are
            // opened in the system browser from JS; anything else (e.g. an SVG <a target=_self>
            // inside a Mermaid diagram) must not replace the app with a remote page.
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("app/index.html".into()))
                .title("MDnote")
                .inner_size(1280.0, 820.0)
                .min_inner_size(720.0, 480.0)
                .center()
                .disable_drag_drop_handler()
                .on_navigation(|url| {
                    matches!(url.scheme(), "tauri" | "http" | "https")
                        && matches!(url.host_str(), Some("tauri.localhost") | Some("localhost") | Some("127.0.0.1"))
                })
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![launch_file, allow_path])
        .build(tauri::generate_context!())
        .expect("error while building MDnote")
        .run(|app, event| {
            // macOS delivers "open with" files as an event instead of an argument.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                if let Some(path) = urls.iter().filter_map(|u| u.to_file_path().ok()).next() {
                    let p = path.to_string_lossy().to_string();
                    allow(app, &p, false);
                    let _ = app.emit("open-file", p);
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app, event);
            }
        });
}
