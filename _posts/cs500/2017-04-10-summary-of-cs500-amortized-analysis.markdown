---
layout: post
title: "Summary of CS500: Amortized Analysis"
date: "2017-04-10 21:16:40 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---

Amortized analysis is a worst-case **analysis of a sequence of operations** — to obtain a tighter bound on **the overall or average cost per operation** in the sequence than is obtained by separately analyzing each operation in the sequence.  
In other words, while certain operations for a given algorithm may have a significant cost in resources, other operations may not be as costly.  
Amortized analysis considers both the costly and less costly operations together over the whole series of operations of the algorithm

Amortized analysis differs from average-case analysis; an amortized analysis guarantees the *average performance of each operation in the worse case*.

Generally three methods for performing amortized analysis:
1. Aggregate analysis:
Determines the upper bound on the total cost of a sequence of $$n$$ operations.
2. Accounting method:
Determines the individual cost of each operation, combining its immediate time and **its influence on the running time of future operations.**  
Usually, many short running operations **<mark>accumulate a debt</mark>** of unfavorable state in small increments, while rare long-running operations decrease it drastically.
3. Potential method:
Like the accounting method, but overcharges operations early to compensate for underchages later.

> Compensate: 보상하다

## 1. Aggregate analysis
For all $$n$$, a sequence of $$n$$ operations takes *worse-case* time $$T(n)$$ in total.  
The average cost, or ***amortized cost***, per operation is therefore $$ \frac{T(n)}{n} $$.

### Example. Incrementing a binary counter
Consider the problem of implementing a $$k$$-bit binary counter that counts upward from 0, by using an array $$A[0...k-1]$$ of bits, where $$A.length = k$$.

![binary_counter](/assets/images/170410/binary_counter.png){: .center-image}
* An 8-bit binary counter as its value goes from 0 to 16 by a sequence of 16 `increment(A)` operations.
{: .center}

```c
void increment(A){
  int i;
  for(i = 0; i < A.length && A[i] == 1; i++){
    A[i] = 0;
  }
  if(i < A.length){
    A[i] = 1;
  }
}
```

From counter value 7 to 8, three 1 bits are flipped to 0 (for loop in the code), and the next 4th bit is set to 1 (`A[i] = 1`) as 4 < 8 (`A.length`).

Assume `increment(A)` is called $$k$$ times. As figure shows,
- `A[0]` flips each time `increment(A)` is called: flips $$k$$ times.
- `A[1]` flips only every other time: flips $$\frac{k}{2}$$ times.
- `A[2]` flips $$\frac{k}{4}$$ times
- ...
- `A[i]` for $$i=k-1$$ flips $$\frac{n}{2^{k-1}}$$ times.

In general,
- `A[i]` for $$i=0, 1, ..., k-1$$, `A[i]` flips $$\frac{n}{2^i}$$ times
- `A[i]` for $$i \ge k$$, `A[i]` never flips.

Hence, the total number of flips in the sequence is  
$$
\begin{align}
\sum_{i=0}^{k-1} \frac{n}{2^i} & < \sum_{i=0}^{\infty} \frac{n}{2^i} \\
& = 2n
\end{align}
$$

The average cost of each operation, and therefore the amortized cost per operation, is $$ \frac {O(n)}{n} = O(1) $$.

## 2. The potential method
The ***potential method*** of amortized analysis **represents the prepaid work as <mark>potential energy</mark>**, that can be released to pay for future operations.

> 잘 발생하지 않는 expensive operation의 cost를 자주 발생하는 cheap operation의 cost를 약간 증가시켜 대체한다고 보면 되겠음.
>
> Accounting method를 설명하지 않는 이유는 potential이 account 역할을 하기 때문. 자주 발생하지 않는 expensive operation을 위해 cheap operation을 실행할 때 미리 account를 쌓아놓는다고 볼 수 있다.

Let

$$c_i$$
: the actual cost of the $$i$$th operation

$$\Phi_i$$
: the potential function after $$i$$th operation

**The amortized cost $$\hat{c_i}$$ of the $$i$$th operation** with respect to potential function $$\Phi$$ is defined by
$$\hat{c_i} = c_i + \Phi_i - \Phi_{i-1}$$.  
The amortized cost of each operation is therefore its actual cost plus the increase in potential due to the operation. Hence, the total amortized cost of the $$n$$ operation is

$$
\begin{align}
\sum_{i=1}^{n} \hat{c_i} & = \sum_{i=1}^{n}(c_i + \Phi_i - \Phi_{i-1}) \\
& = \sum_{i=1}^{n}c_i + \Phi_n - \Phi_0
\end{align}
$$

The average cost of each operation, and therefore the amortized cost per operation, is

$$
\begin{align}
\frac{1}{n} \sum_{i=1}^{n} \hat{c_i}
& = \frac{1}{n} \sum_{i=1}^{n} (c_i + \Phi_i - \Phi_{i-1}) \\
& = \frac{1}{n} \sum_{i=1}^{n}c_i + \frac{\Phi_n - \Phi_0}{n}
\end{align}
$$

***Note that if $$ \Phi_n \ge \Phi_0 $$, then $$ \sum_{i=1}^{n}c_i \le \sum_{i=1}^{n} \hat{c_i}$$, so <mark>the amortized cost can be used as a bound</mark> of total actual cost.***

> We usually define $$ \Phi_0 = 0 $$ and then show that $$ \Phi_i \ge 0 $$ for all $$i$$.
>
> 이 조건이 굉장히 중요하기 때문에 한국어로 재설명. 부등식 $$ \Phi_n \ge \Phi_0 $$ 이 성립해야 amortized cost가 upper bound 역할을 할 수 있다.

### Example. Incrementing a binary counter
We define **the potential $$\Phi_i$$** of the binary counter as **the number of 1s in the counter after the $$i$$th operation.**

Suppose that the $$i$$th operation resets $$t_i$$ bits.
- The acutal cost of the operation is at most $$t_i+1$$, since in addition to resetting $$t_i$$ bits, it sets at most one bit to 1.
- As the number of 1s are decreased by $$t_i$$, and increased by 1, the potential difference is  
$$ \Phi_i - \Phi_{i-1} = 1-t_i$$.

The amortized cost is therefore  
$$
\begin{align}
\hat{c_i} & = c_i + \Phi_i - \Phi_{i-1} \\
& \le (t_i + 1) + (1-t_i) \\
& = 2 \\
& = O(1)
\end{align}
$$

- The amortized cost per operation is $$O(1)$$.
- If the counter starts at zero, then $$\Phi_0 = 0 $$.  
Since $$\Phi_i \ge 0 $$ for all $$i$$, **the toal amortized cost of a sequence of $$n$$ `increment()` operations is <mark>an upper bound</mark> on the total actual cost.**  
Hence, the worse-cast cost of $$n$$ `increment()` operations is $$O(n)$$.

### Example. Stack operations
The example for describing amortized analysis for multiple operations: `push(), pop(), multipop()`.  
We define **the potential $$\Phi_i$$** on a stack to be **the number of objects in the stack.**

- For the empty stack, $$\Phi_0 = 0$$.
- Since the number of objects cannot be negative, $$\Phi_i \ge 0$$ for all $$i$$.

#### 1) Push operation
If the $$i$$th operation on a stack containing $$s$$ objects is a `push(S, n)` operation,

1. The potential diferrence is  
    $$
    \begin{align}
    \Phi_i - \Phi_{i-1} & = (s+1) - s \\
    & = 1
    \end{align}
    $$
2. The amortized cost of this `push()` operation is  
    $$
    \begin{align}
    \hat{c_i} & = c_i + \Phi_i - \Phi_{i-1} \\
    & = 1 + 1 \\
    & = 2
    \end{align}
    $$

#### 2) Pop operation
If the $$i$$th operation on a stack containing $$s$$ objects is a `pop(S)` operation,

1. The potential difference is  
    $$
    \begin{align}
    \Phi_i - \Phi_{i-1} & = (s-1) - s \\
    & = -1
    \end{align}
    $$
2. The amortized cost of this `pop()` operation is  
    $$
    \begin{align}
    \hat{c_i} & = c_i + \Phi_i - \Phi_{i-1} \\
    & = 1 - 1 \\
    & = 0
    \end{align}
    $$

#### 3) Multipop operation
Suppose the $$i$$th operation on a stack containing $$s$$ objects is a `multipop(S, k)` operation and $$k'=min(k,s)$$ objects are popped off the stack.  

1. The actual cost of the operation is $$k'$$.
2. The potential difference is  
    $$
    \begin{align}
    \Phi_i - \Phi_{i-1} & = (s-k') - s \\
    & = -k'
    \end{align}
    $$
3. The amortized cost of this `multipop()` operation is  
    $$
    \begin{align}
    \hat{c_i} & = c_i + \Phi_i - \Phi_{i-1} \\
    & = k' - k' \\
    & = 0
    \end{align}
    $$

#### Summary of stack operations
The amortized cost of each of the three operations is $$O(1)$$, and thus the total amortized cost of a sequence of any $$n$$ operations is $$O(n)$$.

Since we already argued that $$\Phi_i \ge \Phi_0$$, ***the total amortized cost of $$n$$ operations is an upper bound*** on the total actual cost.  
***The worse-cast amortized cost of $$n$$ operations is therefore $$O(n)$$, and the amortized cost per operation is $$O(1)$$.***

vs. worst-case analysis.
- `push(S, k), pop(S)`의 worst-case cost는 $$O(1)$$이고 `multipop(S, k)` operation의 worst-cast cost는 $$O(n)$$이다.
- 따라서, worst-case of any stack operation = $$O(n)$$. ($$∵ O(1) ≤ O(n)$$)
- worst-case of $$n$$ operations is $$O(n^2)$$. (we may have $$O(n)$$ `multipop()` operations costing $$O(n)$$ each.)

amortized cost는 worst-case의 operation sequence인데, stack의 경우에는 모든 operation의 amortized cost가 $$O(1)$$이므로 worst-case sequence of operations은 어떤 조합이라도 될 수 있다. 따라서, amortized cost per operation은 $$O(1)$$이라고 할 수 있음.  
만약 어떤 operation의 amortized cost가 $$O(n)$$이라면 worst-case amortized cost는 해당 operation을 $$n$$번 호출한 sequence operation의 amortized cost의 average이므로 $$O(n)$$이라고 할 수 있음.



## Reference
- Thomas H. Cormen, Charles Eric. Leiserson, Ronald L. Rivest, and Clifford Stein. 2001. Introduction to algorithms, Cambridge, MA: MIT Press.
- Amortized analysis. Wikipedia (December 2016). Retrieved April 10, 2017 from https://en.wikipedia.org/wiki/Amortized_analysis
- Potential method. Wikipedia (April 2017). Retrieved April 10, 2017 from https://en.wikipedia.org/wiki/Potential_method
