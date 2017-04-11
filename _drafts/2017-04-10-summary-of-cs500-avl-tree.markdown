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

|                 | Insert         | Delete         | Search         | Merge    |
|-----------------|----------------|----------------|----------------|----------|
| Time complexity | $$O(log_{}n)$$ | $$O(log_{}n)$$ | $$O(log_{}n)$$ | $$O(n)$$ |

Minimum number of nodes of AVL tree of height $$h$$:
$$N(h+1) = N(h) + N(h-1) + 1$$  
where $$N(0) = 1, N(1) = 2$$.

> 즉, $$T_h$$는 $$T_{h-1}$$과 $$T_{h-2}$$을 두 개의 children으로 가지는 새 루트 노드 하나를 가진 것과 같다.

Note that if we add a number 1 to each side of the equation,  
$$N(h+1)+1 = (N(h) + 1) + (N(h-1) + 1)$$,
Then make a new function $$T(h)=N(h)+1$$, then

$$T(h+1) = T(h) + T(h-1)$$  
which is a Fibonacci number expression, where $$T(0) = F_3 = 2, T(1) = F_4 = 3$$.

### Fibonacci number
> 이 때 Fibonacci number의 growth rate에 대해 배웠음.

$$F_h = \frac {\phi^h - \psi^h}{\sqrt{5}}$$

This equation is knows as *"Binet's formula"*.

where $$\phi=\frac{1+\sqrt{5}}{2}=1.618, \psi=1-\phi=-\frac{1}{\phi}=\frac{1-\sqrt{5}}{2}$$.

Hence, in the slide, $$F_h$$ is expressed as  
$$F_h = \frac{\phi^h - (-\frac{1}{\phi}^h)}{\sqrt{5}} \ge \Omega({1.6}^h)$$.

> Assignment 2: Verify this inequality.
>
> Since the golden ratio satisfies the equation  
$$\phi^2 = \phi+1$$
>
> Thie equation can be used to decompose higher powers $$\phi^h$$ as a linear function of lower powers.
>
> $$
\phi^3 = \phi^2 \cdot \phi = (\phi+1) \cdot \phi = \phi^2+\phi = 2\phi + 1 \\
\phi^4 = \phi^3 \cdot \phi = (2\phi+1)\cdot\phi = 2\phi^2 + \phi = 3\phi+2 \\
\phi^5 = \phi^4 \cdot \phi = (3\phi+2)\cdot\phi = 3\phi^2 + 2\phi = 3(\phi+1)+2\phi = 5\phi+3
$$
>
> The coefficients are Fibonacci numbers, where
$$\phi^h = F_h\phi + F_{h-1}$$.  
> Hence, $$F_h\phi \ge \phi^h$$, as $$F_{h-1} \ge 0 $$ for all $$h \ge 1$$. Therefore, $$F_h = \Omega(\phi^h)=\Omega(1.6^h)$$.


<!--
Minimum number of nodes of AVL tree of height $$h$$:  
$$\#T(0)+1=F_3, \#T(h+1)+1=\#T(h)+1+\#T(h-1)+1=F_{h+4}$$  
with Fibonacci number $$F_h$$.
-->

## Reference
- Minimal AVL trees. http://stackoverflow.com/a/30770189
- AVL tree. https://en.wikipedia.org/wiki/AVL_tree
- Fibonacci number. https://en.wikipedia.org/wiki/Fibonacci_number
