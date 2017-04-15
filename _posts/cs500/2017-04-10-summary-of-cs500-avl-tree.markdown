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

$$F_h = \frac {\varphi^h - \psi^h}{\sqrt{5}}$$

This equation is knows as *"Binet's formula"*.

where $$\varphi=\frac{1+\sqrt{5}}{2}=1.618, \psi=1-\varphi=-\frac{1}{\varphi}=\frac{1-\sqrt{5}}{2}$$.

In the lecture slide, $$F_h$$ is expressed as  
$$F_h = \frac{\varphi^h - (-\frac{1}{\varphi}^h)}{\sqrt{5}} \ge \Omega({1.6}^h)$$.

> Assignment 2: Verify this inequality.
>
> ***Theorem.*** For all integers $$n \ge 3$$, $$F_n \gt \varphi^{n-2} = \Omega({\varphi}^n)$$, where $$\varphi = 1.618$$.
>
> **Base cases.**  
- For $$n=3$$, $$F_3 = 2 \gt \varphi = 1.618$$.  
- For $$n=4$$, $$F_4 = 3 \gt \varphi^2 = 2.618$$.
>
> **Inductive step.** Note that $$\varphi^2 = \varphi + 1$$, thus $$\varphi^{k-1} = (\varphi+1)\varphi^{k-3}$$.
- For $$k \ge 4$$, assume $$F_{k-1} \gt \varphi^{k-3}$$ and $$F_k \gt \varphi^{k-2}$$.
- So, $$F_{k+1} = F_k + F_{k-1} \gt \varphi^{k-2} + \varphi^{k-3} = \varphi^{k-1}$$.
>
> Thus, $$F_n \ge \Omega(\varphi^n)$$ holds for all integers $$n \ge 3$$.

<!--
> AS $$\varphi = \frac{1+\sqrt{5}}{2} > 1$$, $${\frac{1}{\varphi}}^h$$ goes to $$+0$$ when $$h \rightarrow \infty$$.
>
> Hence, $$\frac{\varphi^h}{\sqrt{5}} = \Omega({\varphi^h}) \le
\frac{\varphi^h - (-{\frac{1}{\varphi}}^h)}{\sqrt{5}} = F_h$$
>
-->

> **Another study**
>
> Since the golden ratio satisfies the equation
$$\varphi^2 = \varphi+1$$
>
> Thie equation can be used to decompose higher powers $$\varphi^h$$ as a linear combination of $$\varphi$$ and 1.
>
> $$
\varphi^3 = \varphi^2 \cdot \varphi = (\varphi+1) \cdot \varphi = \varphi^2+\varphi = 2\varphi + 1 \\
\varphi^4 = \varphi^3 \cdot \varphi = (2\varphi+1)\cdot\varphi = 2\varphi^2 + \varphi = 3\varphi+2 \\
\varphi^5 = \varphi^4 \cdot \varphi = (3\varphi+2)\cdot\varphi = 3\varphi^2 + 2\varphi = 3(\varphi+1)+2\varphi = 5\varphi+3
$$
>
> The coefficients are Fibonacci numbers, where
$$\varphi^h = F_h\varphi + F_{h-1}$$.  
> Hence, $$F_h\varphi \le \varphi^h$$, as $$F_{h} \ge 0 $$ for all $$h \ge 0$$. Therefore, $$F_h = O(\varphi^h)=O(1.6^h)$$.
>
<!-- I cannot derive $$\Omega({1.6}^h)$$ yet.-->

### Rotation
When inserting an element into an AVL tree, the AVL tree property can be violated. In this case, the tree should be rotated.

There are two types of rotation: **single rotation** and **double rotation**.

#### Single rotation
![ll](http://btechsmartclass.com/DS/images/LL%20Rotation.png){: .center-image width="700px"}
* Single left rotation (LL rotation).
{: .center}

![rr](http://btechsmartclass.com/DS/images/RR%20Rotation.png){: .center-image width="700px"}
* Single right rotation (RR rotation).
{: .center}

#### Double rotation
![lr](http://btechsmartclass.com/DS/images/LR%20Rotation.png){: .center-image width="700px"}
* Double left-right rotation (LR rotation).
{: .center}

![rl](http://btechsmartclass.com/DS/images/RL%20Rotation.png){: .center-image width="700px"}
* Double right-left rotation (RL rotation).
{: .center}

<!--
Minimum number of nodes of AVL tree of height $$h$$:  
$$\#T(0)+1=F_3, \#T(h+1)+1=\#T(h)+1+\#T(h-1)+1=F_{h+4}$$  
with Fibonacci number $$F_h$$.
-->

As it requires $$O(n)$$ to merge two AVL trees, binomial tree is introduced.

## Reference
- Minimal AVL trees. http://stackoverflow.com/a/30770189
- AVL tree. https://en.wikipedia.org/wiki/AVL_tree
- Fibonacci number. Wikipedia. https://en.wikipedia.org/wiki/Fibonacci_number
- AVL Tree. Btech Smart Class. http://btechsmartclass.com/DS/U5_T2.html
- Lower bound on Fibonacci number. Duke University. https://www.cs.duke.edu/courses/spring06/cps102/notes/slides10-4up.pdf
