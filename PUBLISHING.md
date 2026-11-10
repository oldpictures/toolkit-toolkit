# publishing toolkit toolkit on github

this folder is ready to be used as the root of a repository named `toolkit-toolkit`.

## first upload (without git)

1. create a new **public** repository at https://github.com/new named `toolkit-toolkit`. do not initialize it with a readme or license when uploading this prepared set of files.
2. use github desktop, `git` (below), or github's **add file → upload files** flow to upload the **contents** of this folder, preserving paths.
3. under **settings → pages**, select **deploy from a branch**, choose branch `main`, folder `/docs`, then **save**.
4. the website will appear at `https://YOUR_USERNAME.github.io/toolkit-toolkit/` after deployment finishes.
5. in **about** on the repository sidebar, add a description and optionally set your website url.
6. optionally create a release with tag `v0.10.15` and attach `docs/downloads/toolkit-toolkit-v0.10.15.zip`.

## git command alternative

run the following inside the folder, after making the empty github repository:

```bash
git init
git add .
git commit -m "initial public toolkit toolkit repository"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/toolkit-toolkit.git
git push -u origin main
```

replace `YOUR_USERNAME` with the actual github username.

## release / extension distribution note

`docs/downloads/toolkit-toolkit-v0.10.15.zip` is intended for developer-mode loading as a temporary firefox add-on after extracting. it is **not** a signed `.xpi` and should not be presented as one-click installation. for permanent firefox installs, follow mozilla's add-on signing and distribution requirements.

## review before public release

- verify you can publicly redistribute any code originally based on another extension.
- choose a suitable license (if you intend to grant reuse rights); no license is intentionally included.
- verify no access tokens, passwords, or private user data have been added.
- note that a github pages site itself is public.
