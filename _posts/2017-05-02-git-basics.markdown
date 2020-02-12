---
layout: post
title: "Git Basics"
date: "2017-05-02 09:58:43 +0900"
author: "Insu Jang"
tag: [study, git]
---

# 1. Initialize a Git Repository

```
$ git init
```

This will create `.git` directory to store all information for version control.

# 2. Checking out a Remote Repository

```
$ git checkout https://github.com/username/abc.git
$ git checkout https://github.com/username/abc.git branch_name
```

The last `.git` can be omitted. This will copy files in the remote repository. You can directly checkout a branch by adding `branch_name` to the tail of the command.

To checkout a remote branch into the existing git local repository, use the following:

```
$ git fetch
$ git checkout branch_name
```

# 3. Commit / Push

```
$ git commit -m "commit message"
$ git push origin branch_name  (e.g. git push origin master)
```

Unlike SVN, git has two steps to apply changes to a remote repository. First is `commit`, record a checkpoint in **local repository**, and the next is `push`, transfer it into **remote repository**.

`origin` in push command means the remote repository you checked out.

# 4. Git branch_name

Branch is a beauty of git. You can work with coworkers without any interference with them.

- Creating a branch

    ```
    $ git branch branch_name
    ```

    This will create a local branch with the name `branch_name`. Then you can switch your branch to this by `git checkout branch_name`.

- Listing branches

    You can see the list of branches by typing the following command.

    ```
    $ git branch --list (-l)
    ```

    Or, if you also want to see branches in a remote repository, type the following.

    ```
    $ git branch --all (-a)
    ```

- Merging branches

    To merge two branches, first go to the branch that will be a base. In most case, it will be `master` branch. Then merge with the target branch.

    ```
    $ git checkout master
    $ git merge branch_name
    ```

- Deleting a branch

    After merging two branches, they still remain. If you complete your work in a branch, you can delete it by

    ```
    $ git branch --delete branch_name
    ```

    Or if you want to remove a branch in a remote repository, you can type

    ```
    $ git branch --delete branch_name
    $ git push origin :branch_name
    ```

    colon (:) is the key.
    After deleting a local branch, push this change into the remote repository.
