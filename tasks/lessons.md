# Lessons

- When a user asks to commit a project in a nested folder, verify the actual git root first and commit inside the requested project repo, not the nearest parent repo.
- Before any `yolo` commit+push, confirm whether the target folder is its own repository or only a subdirectory of a larger repository.
- In a fullscreen stage, never use bottom padding on the stage shell to "make room" for overlay UI. Keep the stage locked to viewport height and position controls/trays absolutely inside it, then verify `scrollHeight` does not exceed `innerHeight`.
- When an upload button "works" but no thumbnail appears, verify the real upload pipeline with a browser-selected file and inspect console/network errors before touching the button UI. The click path can be innocent while Storage is the one smoking crack.
