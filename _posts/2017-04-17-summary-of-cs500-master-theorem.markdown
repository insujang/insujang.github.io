---
layout: post
title: "Summary of CS500: Master Theorem"
date: "2017-04-17 21:28:29 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---

# Master Theorem
The master theorem provides a solution for ***recurrence relations*** of types.

> Not all recurrence relations can be solved with the use of the master theorem.

Recurrence relations of the form:  
$$T(n) = aT(\frac{n}{b})+O(n^k)$$

- If $$a>b^k$$, $$T(n)=O(n^{log_{b}a})$$
- If $$a=b^k$$, $$T(n)=O(n^klogn)$$
- If $$a<b^k$$, $$T(n)=O(n^k)$$

## Example

$$
\begin{align}
T(n) &= 3T(\frac{2}{3}n)+1 \\
&= 3T(\frac{2}{3}n)+O(1)
\end{align}
$$

Then, by the master theorem,  
$$a=3, b=\frac{3}{2}, k=0$$

Then, as $$3=a>1=b^k$$, the time complexity is  
$$
\begin{align}
T(n) &= O(n^{log_{\frac{3}{2}}3}) \\
&= O(n^{\frac{log3}{log1.5}})
\end{align}
$$
