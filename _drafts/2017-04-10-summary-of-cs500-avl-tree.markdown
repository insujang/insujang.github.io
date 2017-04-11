---
layout: post
title: "Summary of CS500: AVL Tree"
date: "2017-04-10 16:51:27 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---
> AVL Tree was handled as a recap in the lecture.

## AVL Trees
A ***self-balancing*** binary search tree.  
Heights of any two sibling subtrees must differ by ***at most one***.

![minimum avl tree](https://i.stack.imgur.com/uXBst.png){: .center-image}
* Minimal size of AVL trees.
{: .center}

Minimum number of nodes of AVL tree of height $$h$$:  
$$\#T(0)+1=F_3, \#T(h+1)+1=\#T(h)+1+\#T(h-1)+1=F_{h+4}$$  
with Fibonacci number $$F_h$$.


## Reference
- Minimal AVL trees. http://stackoverflow.com/a/30770189
- AVL tree. https://en.wikipedia.org/wiki/AVL_tree
