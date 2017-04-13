---
layout: post
title: "Summary of CS500: Disjoint Sets"
date: "2017-04-13 15:29:26 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---

# Disjoint Set Data Structure
A **disjoint-set data structure** is a data structure that keeps track of a set of elements partitioned into a number of disjoint (nonoverlapping) subsets.

> Hence it can be used with Kruskal's algorithm for minimal spanning tree creation.

It supports useful operations:
- **MakeSet**: Make a set containing only a given element $$x$$.  
Since the sets are disjoint, it is required that $$x$$ not already be in some other set.
- **Find**: Determine which subset a particular element $$x$$ is in.
- **Union**: Join two subsets into a single subset.

In the textbook, two more functions are provided.
- **`ConnectedComponents(G)`**:

    - Initially places each vertex $$v$$ in its own set.
    - For each edge $$(u, v)$$, it merges the sets containing $$u$$ and $$v$$.
- **`SameComponent(u, v)`**: A query about whether two vertices are in the same connected component.

```
ConnectedComponents(G)
for each vertext v in G.vertex
    MakeSet(v)
for each edge (u, v) in G.edge
    if Find(u) != Find(v)
        Union(u, v)
```

# Representation of Disjoint Sets
### 1. Linked-list

- The object for each set has attributes
    1. **head**: Point to the first object in the list.
    2. **tail**: Point to the last object.
- Each object contains a set of vertices in any order.

![disjoint_linked_list](/assets/images/170412/disjoint_linked_list.png){: .center-image width="800px"}
* Linked list representation of disjoint sets. (b) represents the result of `Union(g, e)`.
{: .center}

- **`MakeSet(x)`**: Create a new linked list whose only object is $$x$$. ($$O(1)$$)
- **`FindSet(x)`**: Follow the pointer from $$x$$ back to its set object and return the the object that *head* points to. ($$O(1)$$)
- **`Union(x, y)`**:

    - Append y's list onto the end of x's list.
    - Modify x's tail pointer to y's tail.
    - Update the pointer to the set object for all emenets in y's list, to S1.  
    For example, in the above figure, pointers in the object c, h, e, b should be updated.

We construct a sequence of $$m$$ operations on $$n$$ objects. Suppose we have $$n$$ object, $$x_1,x_2,...,x_n$$. We execute the sequence of $$n$$ `MakeSet` operations, and $$n-1$$ `Union` operations, so that $$m=2n-1$$.

![disjoint_linked_list_operations](/assets/images/170412/disjoint_linked_list_operations.png){: .center-image width="400px"}
* A sequence of $$2n-1$$ operations on $$n$$ object takes $$\Theta(n^2)$$ time.
{: .center}

The total number of objects updated by all $$n-1$$ `Union` operations is

$$\sum_{i=1}^{n-1}i=\Theta({n^2})$$

The total number of operations is $$2n-1$$, so each operation on average requires $$\Theta(n)$$ time.

That is, the amortized time of an operation is $$\Theta(n)$$.

### 2. A weighted-union heuristic
`Union` requires an average of $$\Theta(n)$$ per call in the worst case, because we may be **<mark>appending a longer list onto a shorter list</mark>**; we must update the pointer to the set object for each element of the longer list.

- Each list also includes the length of the list.
- We can always append the shorter list onto the longer.
- **A sequence of $$m$$ `MakeSet, Union, FindSet` operations, $$n$$ of which are `MakeSet` operations, takes $$O(m+nlog_{}n)$$ time.**

We perform at most $$n-1$$ `Union` operations over all.

Consider a particular object $$x$$. Each time $$x$$'s pointer was updated, $$x$$ must started in the smaller set.
- The first time $$x$$'s pointer was update, the resulting set must have had at least 2 members.
- The next time $$x$$'s pointer was update, the resulting set must have had 4 members.
...
For any $$k \le n$$, after $$x$$'s pointer has been update $$log_{}k$$ times, the resulting set must have at least $$k$$ members. Since the largest set has at most $$n$$ members, each object's pointer is updated at most $$log_{}n$$ times over all the `Union` operations.

Thus the total time spent over all `Union` operations is $$O(nlog_{}n)$$.  
Each `MakeSet` and `FindSet` operation takes $$O(1)$$ time, and there are $$O(m)$$ of them.

The total time for the entire sequence is thus $$O(m+nlog_{}n)$$.

<!--
* A single `Union` operation still take $$\Omega(n)$$ if both sets have $$\Omega(n)$$ members.
-->


## Disjoint Set forests
> As all connected grahps generated during minimum spanning tree generation is a tree, it can be called as a forest.

![disjoint_set_forest](/assets/images/170412/disjoint_set_forest.png){: .center-image}
* A disjoint set forest. (b) represents the result of `Union(e, g)`.
{: .center}

![union_by_rank](/assets/images/170412/union_by_rank.png){: .center-image}
* Each node has a ***rank***, which is the height of its subtree.

Although the straightforward algorithms that use this representation are no faster than ones that use the linked-list representation, we can achieve **an asymptotically optimal (linear running time in the total number of operations $$m$$ disjoint-set data structure by introducing two heuristics: "union by rank", and "path compression"**.

1. **Union by rank**:  
Similar to the weighted-union heuristic.

    **<mark>Make the root with smaller rank point to the root with larger rank</mark> during a `Union` operation.**

    If both trees have the same rank, link one to the other and **increase the rank of a new root by one**.

2. **Path compression**:  
Make each node on the `FindSet()` path **<mark>point directly to the root</mark>**. But it does not change any ranks.

    ![disjoint_set_path_compression](https://courses.cs.washington.edu/courses/cse326/00wi/handouts/lecture18/img035.gif){: .center-image width="600px"}
    * Each node has a pointer to its parent. After executing `FindSet(e)`, each node on the find path (c, a, b, e) now points directly to the root (c).
    {: .center}

#### Operations
1. `MakeSet(x)`

    ```
    x.parent = x
    x.rank = 0
    ```
2. `Union(x, y)`

    ```
      Link(FindSet(x), FindSet(y))
    ```
3. `Link(x, y)`

    ```
    if x.rank > y.rank
        y.parent = x
    else
        // if two trees have same rank, link on to the other and increase the rank of the other.
        x.parent = y
        if x.rank == y.rank
            y.rank = y.rank + 1
    ```
4. `FindSet(x)`

    ```
    if x != x.parent
        x.parent = FindSet(x.parent)
    return x.parent
    ```


Using both union by rank and path compression, the worse case running time is $$O(m \alpha(n))$$ for $$m$$ disjoint-set operations on $$n$$ elements, where $$\alpha(n)$$ is a very slowly growing function.  
In any conceivable application of a disjoint-set data structure, $$\alpha(n) \le 4$$.


### A very quickly growing function and its very slowly growing inverse
- $$2^n$$: exponential  
$$2^{2^n}$$: doubly exponential  
$$2^{2^{.^{.^{.^2}}}}$$: tower of height $$n$$.  
a.k.a. **<mark>tetration</mark>** $$2\uparrow\uparrow n=2^{2\uparrow\uparrow(n-1)}$$
- $$logN=min\{n: 2^n \ge N\}$$  
$$loglogN=min\{n: 2^{2^n} \ge N\}$$  
$$log*(N)$$ = # iterations of log = $$1+log*(logN)$$

Example:  
$$
\begin{align}
log*(2^{256}) & = 1+log*(256) &= 1+log*(2^8) \\
&= 2+log*(8) &= 2+log*(2^3) \\
&= 3+log*(3) &= 3+log(2^{1.7...}) \\
&= 4+log*(1.7) &= 5
\end{align}
$$

#### Ackermann function
$$A_0(n)=n+2 \\
A_{k+1}(0)=A_k(1) \\
A_{k+1}(n+1) = A_k(A_{k+1}(n))$$

> The definition of Ackermann function in here is different from that in Wikipedia.

Example:  
$$
\begin{align}
A_1(n) &= 2n+3 \\
A_2(n) &= 2^{n+3}-3 \\
A_3(n) &= 2\uparrow\uparrow(n+3)-3
\end{align}
$$

#### Inverse Ackermann
$$\alpha(N) = min\{n: A_n(n) \ge N\}$$

<!--
For integers $$k \ge 0$$ and $$j \ge 1$$, we define the function $$A_k(j)$$ as

$$A_k(j)= \begin{cases}
j+1 &\text{if  } k=0 \\
A_{k-1}^{(j+1)}(j) &\text{if  } k \ge 1.
\end{cases}
$$

where the expression $$A_{k-1}^{(j+1)}(j)$$ **uses the functional interation notation**:

$$ A_{k-1}^{0}(j) = j \\
A_{k-1}^{(i)}(j) = A_{k-1}(A_{k-1}^{(i-1)}(j))
$$

The parameter $$k$$ is referred as the **level of the function A**.

#### Example
We see how quickly $$A_k(j)$$ grows by simply examining $$A_k(1)$$ for levels $$k=0, 1, 2, 3, 4$$.

$$
A_0(1) = 1 + 1 = 2 \\
A_1(1) = A_0^2(1) = 2 + 1 = 3 \\
A_2(1) = A_1^2(1) = 2^{(1+1)} \cdot (1+1) - 1 = 7 \\
A_3(1) = A_2^2(1) = A_2(A_2(1)) = A_2(7) = 2^8 \cdot 8 - 1 = 2^{11} - 1 \\
A_4(1) = A_3^2(1) = A_3(A_3(1)) = A_3(2047) = A_2^{2048}(2047) >> A_2(2047) = 2^{2048} \cdot 2048 - 1 > 2^{2048} = 16^512 >> 10^{80}
$$

The symbol $$>>$$ denotes that the "much-grater-than" relation.

Define the inverse of the function $$A_k(n)$$, for integer $$n \ge 0$$:  
$$ \alpha(n) = min\{k:A_k(1) \ge n\}$$.

In words, $$\alpha(n)$$ is the lowest level $$k$$ for which $$A_k(1)$$ is at least $$n$$. From the above values of $$A_k(1)$$, we see that  
$$ \alpha(n) = \begin{cases}
0 &\text{for } 0 \le n \le 2, \\
1 &\text{for } n = 3, \\
2 &\text{for } 4 \le n \le 7, \\
3 &\text{for } 8 \le n \le 2047, \\
4 &\text{for } 2048 \le n \le A_4(1).
\end{cases}
$$
-->

## Potential function
$$\Phi_q(x)$$
: A potential to the node $$x$$ after $$q$$ operations.

    $$
    \phi_q(x) = \begin{cases}
    \alpha(n) \cdot x.rank &\text{if } x \text{ is a root or } x.rank = 0 \\
    (\alpha(n) - \text{level}(x)) \cdot x.rank - \text{iter}(x) &\text{if } x \text{ is not a root and } x.rank \ge 1
    \end{cases}
    $$

    where
    - $$\text{level}(x) = max\{k: x.parent.rank \ge A_k(x.rank)\}$$  $$\therefore(0 \le \text{level}(x) \le \alpha(n))$$
    - $$\text{iter}(x) = max\{i : x.parent.rank \ge A_{\text{level}(x)}^i(x.rank)\}$$ $$\therefore(1 \le \text{iter}(x) \le x.rank)$$

$$\Phi_q$$
: Sum the node potentials for the potentials of the entire tree. $$\Phi_q = \sum_{x}\phi_q(x)$$


> The value of $$\Phi_q(x)$$ depends on whether $$x$$ is a tree root or not, after $$q$$th operation.

## Amortized cost of disjoint set operations
1. `MakeSet()`: $$O(1)$$ (Lemma 21.11)

    **Actual cost**: $$O(1)$$.

    **Potential change**:  
    This operation creates node $$x$$ with rank 0, so $$\phi_q(x) = 0$$. No other ranks or potentials change, so $$\Phi_q = \Phi_{q-1}$$.

    **Amortized cost**: $$O(1)$$.
2. `Link()`: $$O(\alpha(n))$$ (Lemma 21.12)

    Suppose `Link(x, y)` makes y the parent of x.

    **Actual cost**: $$O(1)$$.

    **Potential change**:  
    Note that the only nodes whose potentials may change are x, y, and the children of y.
    - By Lemma 21.10, any y's child node cannot have its potential increase due to the `Link()`.
    - Since $$x$$ was a root before the $$q$$th operation, $$\phi_{q-1}(x) = \alpha(n) \cdot x.rank$$.
        - If x.rank == 0, $$\phi_q(x) = \phi_{q-1}(x) = 0$$
        - Otherwise, $$\phi_q(x) < \alpha(n) \cdot x.rank = \phi_{q-1}(x)$$

        So x's potential decreases.
    - Since $$y$$ was a root before $$q$$th operation, $$\phi_{q-1}(y) = \alpha(n) \cdot y.rank$$.

        $$y$$ remains as a root, it either leaves y's rank same or it increases y's rank by 1.  
        Therefore, either $$\phi_q(y) = \phi_{q-1}(y)$$ or $$\phi_q(y) = \phi_{q-1}(y) + \alpha(n)$$.

    **Amortized cost**: $$O(1)+\alpha(n) = O(\alpha(n))$$
3. `FindSet()`: $$O(\alpha(n))$$ (Lemma 21.13)

    **Actual cost**: $$O(s)$$. ($$s$$ is the number of nodes that the find path contains.)

    **Potential change**:  
    No node's potential increases due to the `FindSet()` operation, and at least $$max(0, s-(\alpha(n)+2))$$ nodes on the find path have their potential decrease by at least 1. (Proof omitted)

    **Amortized cost**: at most $$O(s) - (s-(\alpha(n)+2))=O(s)-s+O(\alpha(n))=O(\alpha(n))$$.

**Theorem 21.14**  
A sequence of $$m$$ `MakeSet(), Union(), FindSet()` operations, $$n$$ of which are `MakeSet()` operations, can be performed on a disjoint-set forest with union by rank and path compression **in worst-case time $$O(m\alpha(n))$$**, where $$\alpha$$ is an *extremely slowly-growing function*.

## Reference
- Disjoint Set Forest. Stanford University. https://web.stanford.edu/class/cs166/lectures/16/Small16.pdf
- Path compresison. University of Wahington. https://courses.cs.washington.edu/courses/cse326/00wi/handouts/lecture18/sld035.htm
- Ackermann function. Wikipedia. https://en.wikipedia.org/wiki/Ackermann_function
