---
layout: post
title: "Summary of CS500: Fibonacci Heap"
date: "2017-04-10 16:22:50 +0900"
author: "Insu Jang"
tag: [study, algorithm, cs500]
math: true
---
# Relaxed Binomial Tree
Remember that the definition of a binomial tree is

> A binomial tree of order $$ k $$ has a root node whose children are roots of binomial trees of orders $$ k-1, k-2, ..., 2, 1, 0 $$ (in this order).

A relaxed binomial tree $$ U_k $$ of order $$k$$ consists of a root with $$k$$ children, $$j$$-th $$(j=1...k)$$ of which is a relaxed binomial tree of order $$k' \ge j-2$$.

![relaxed_binomial_tree](/assets/images/170409/relaxed_binomial_tree.png){: .center-image width="800px"}
* Comparison between a binomial tree $$ B_k $$ and a relaxed binomial tree $$ U_k $$.
{: .center}

# Unordered Binomial Trees
The textbook does not use the definition of relaxed binomial tree, but explains an *unordered binomial tree*.

An unordered binomial tree is like a binomial tree, and it is defined recursively, too.  

- The unordered binomial tree $$ U_0 $$ consists of a single node.
- An unorrdered binomial tree $$ U_k $$ consists of two unordered binomial trees $$ U_{k-1} $$ for which the root of one is made into *any* child of the root of the other.

# Fibonacci Heaps
There are two definitions, one from the course slide, and the other from the textbook.
- A Fibonacci heap $$ H $$ is a list of $$ t $$ heap-ordered relaxed binomial trees with a pointer to the root whose key is the minimum. (slide)
- A Fibonacci heap $$ H $$ is a collection of min-heap-ordered trees. The trees in a Fibonacci heap are not constrained to be binomial trees, however. (textbook)

> Both are same, because consolidating trees actually makes a relaxed binomial tree.

**Key difference between Binomial heap and Fibonacci heap**
- Binomial heap: <mark>eagerly</mark> consolidate trees after each *insert*.
- Fibonacci heap: <mark>lazily</mark> defer consolidation until next *extractMin*.

![fibonacci_heap](/assets/images/170409/fibonacci_heap.png){: .center-image width="800px"}
* An example of Fibonacci heap
{: .center}

$$ H.min $$
: A pointer to the root of a tree containing a minimum key.

$$ x.degree $$
: The number of children in the child list of node $$ x $$.

$$ x.mark $$
: Whether node $$ x $$ has lost a child since the last time $$ x $$ was made the child of another node.

$$ H.n $$
: The number of nodes currently in $$ H $$.

Potential function
: Potential function $$ \Phi(H) $$ is defined as $$ \Phi(H) = t(H) + 2m(H) $$ where  
$$ t(H) $$ = the number of trees in the root list of $$ H $$  
$$ m(H) $$ = the number of marked nodes in $$ H $$.

## Operations of Fibonacci heaps
1. Creating a new Fibonacci heap ($$ \Theta(1) $$)
2. Inserting a node ($$ \Theta(1) $$ )
3. Finding the minimum node ($$ \Theta(1) $$)
4. Merging two Fibonacci heaps ($$ \Theta(1) $$)
5. Extracting the minimum node ($$ O(lg_{}n) $$))
6. Decreasing a key ($$ \Theta(1) $$)


### 1. Creating a new Fibonacci heap (`MakeFibHeap()`)
Allocates and returns the Fibonacci heap object `H`, where
- `H.numberOfElement = 0`
- `H.min = null` (There are no trees in `H` yet)

Potential of the empty Fibonacci heap is $$ \Phi(H) = 0 $$, because $$ t(H) = 0 $$ and $$ m(H) = 0 $$.

The amortized cost of `MakeFibHeap()` is equal to its $$ O(1) $$ actual cost.

### 2. Inserting a node (`FibHeapInsert(H, x)`)
Insert node $$ x $$ into Fibonacci heap $$ H $$.

![fib_heap_insert](/assets/images/170409/fib_heap_insert.png){: .center-image width="800px"}

***Unlike the `BinomialHeapInsert()` operation, `FibHeapInsert()` <mark>makes no attempt to consolidate</mark> the trees within the Fibonacci heap.***

- **Actual Cost**: $$ O(1) $$  
- **Increased Potential**: $$ \Delta t(H) = 1 $$ and $$ \Delta m(H) = 0 $$, hence $$ \Delta \Phi(H) = 1 $$.
- **Amortized Cost**: $$ O(1) + 1 = O(1) $$.

### 3. Finding the minimum node (`FibHeapFindMin(H)`)
The minimum node of a Fibonacci heap $$ H $$ is given by the pointer $$ H.min $$.

- **Actual Cost**: $$ O(1) $$  
- **Increased Potential**: 0
- **Amortized Cost**: $$ O(1) $$.

### 4. Merging two Fibonacci heaps (`FibHeapMerge(H1, H2)`)
It simply concatenates the root lists of $$ H_1 $$ and $$ H_2 $$ and then determines the new minimum node.

- **Actual Cost**: $$ O(1) $$. Concatenating done in $$ O(1) $$ time, and determining the new minimum node is to compare two min (`H1.min` and `H2.min`), so $$ O(1) $$ time.  
- **Changed Potential**: 0. Because

    $$
    \Phi(H) - (\Phi(H_1) + \Phi(H_2)) \\
    = (t(H) + 2m(H)) - ((t(H_1) + 2m(H_1)) + (t(H_2) + 2m(H_2))) \\
    = 0
    $$
- **Amortized Cost**: $$ O(1) $$.

### 5. Extracting the minimum node (`FibHeapExtractMin(H)`)
The process of extracting the minimum node is the most complicated operation. **It is also where <mark>the delayed work of consolidating trees in the root list finally occurs.</mark>**

- Add all children of `H.min` node to the root list of $$ H $$.
- Remove `H.min` from $$ H $$. Now `H.min` temporarily saves the next node of `H.min`, as `H.min = H.min.right`.
- Reduce the number of trees in the Fibonacci heap by ***<mark>consolidating</mark> the root list of $$ H $$.***

***Consolidating the root list*** consists of repeatedly executing the following steps until every root in the root list has a distinct ***degree*** value.
1. Find two roots $$x$$ and $$y$$ in the root list with the same degree, where $$x.key \le y.key$$.
2. ***Link.***: remove $$y$$ from the root list, and make $$y$$ a child of $$x$$.  
The field `x.degree` is incremented, and the mark of $$y$$ is cleared.

> Note that $$ D(n) $$ is the maximm degree of any node in an *n*-node Fibonacci heap, where $$ D(n) \le log_{}n $$.

- **Actual Cost**: $$O(D(n) + t(H))$$.  
The size of the root list is at most $$D(n) + t(H) - 1$$, since
    1. It consists of the original $$t(H)$$ root-list nodes
    2. It consists the childrent of the extracted node (at most $$D(n)$$)
    3. Minus the extracted root node

    Total number of iterations of the `while()` loop is at most the number of roots in the root list. Thus, the total actual work in extracting the minimum node is $$O(D(n) + t(H))$$.

- **Changed Potential**: $$D(n) + 1 - t(H)$$.  
    1. The potential before etracting the minimum node: $$t(h) + 2m(H)$$, and
    2. The potential afterward: $$(D(n) + 1 + 2m(H))$$, since at most $$D(n) + 1$$ roots remain and no nodes become marked during the operation.

- **Amortized Cost**: Actual cost + changed potential =

    $$
    O(D(n) + t(H)) + ((D(n) + 1) + 2m(H)) - (t(H) + 2m(H)) \\
    = O(D(n)) + O(t(H)) - t(H) \\
    = O(D(n))
    $$

    By the definition of the maximum degree $$D(n)$$, $$D(n) \le log_{}n = O(log_{}n)$$. So the amortized cost of extracting the minimum node is $$O(log_{}n)$$.


### 6. Decreasing a key (`FibHeapDecrKey(H, x, k)`)
> Note that $$ D(n) $$ is the maximm degree of any node in an *n*-node Fibonacci heap, where $$ D(n) \le log_{}n $$.

After assigning a new key $$k$$ to $$x$$, if $$x.key \ge y.key$$, where $$y$$ is the parent of the node $$x$$, min-heap order has not been violated and done.

If min-heap order has been violated, however, many changes occur.
1. Cut $$x$$ the link between $$x$$ and its parent $$y$$, making $$x$$ as a root.
    ![fib_heap_delete1](/assets/images/170409/fib_heap_decr1.jpg){: .center-image width="800px"}  
    * The node with key 46 has its key decreased to 15. The node becomes a root, and its parent (with key 24) becomes marked.
    {: .center}
2. $$x$$ might be the second child cut from its parent $$y$$. $$y$$ is cut, and `CascadingCut()` calls itself recursively on $$y$$'s parent $$z$$.
    ![fib_heap_decr2](/assets/images/fib_heap_decr2.jpg){: .center-image width="800px"}
    * The node (with key 35) has its key decreased to 5, and `CascadingCut()` is called, as its parent node is already marked.
    {: .center}
    ```c
    void CascadingCut(H, y){
      z = y.parent;
      if (z != null){
        // Mark the parent node. Marking means that this parent node loses a child at first.
        if(y.mark == false) y.mark = true;   
      }
      else {
        // Remove y from the child list of z, decrementing z.degree
        // Add y to the root list of H.
        Cut(H, y, z);

        // Call CascadingCut recursively to its parent node, z.
        CascadingCut(H, z);
      }
    }
    ```
    By calling `CascadingCut(y)`, $$y$$ is cut and added to the root list of $$H$$, and `CascadingCut(y)` calls itself recursively on $$y$$'s parent $$z$$, `CascadingCut(z)`.

Once all the cascading cuts have occurred, `FibHeapDecrKey()` updates `H.min`.  The only node whose key changed was the node $$x$$ whose key decreased. **Thus, the new minimum node is either the original minimum node or node $$x$$.**

- **Actual Cost**: $$O(c)$$.

    `FibHeapDecrKey()` takes $$O(1)$$ time + the time to perform the cascading cuts.
    Suppose `CascadingCut()` is recursively called $$c$$ times, then the actual cost including all recursive calls is $$O(c)$$.

- **Changed Potential**: $$4-c$$.

    Each recursive call of `CascadingCut()`, except for the last one, cuts a marked node and creats a root node. Afterwards, there are $$t(H) + c$$ trees.  
    (The original $$t(H)$$ trees, $$c-1$$ trees produced by cascading cuts, and the tree rooted at $$x$$)

    When `CascadingCut()` cuts a marked node, it erases the mark, hence there are at most $$m(H)-c+2$$ marked nodes after cascading cuts.
    ($$c-1$$ unmarked by cascading cuts, the last call of `CascadingCut()` **may have marked** a node)

    The change in potential is at most  
    $$
    ((t(H)+c)+2(m(H)-c+2)) - (t(H)+2m(H)) = 4-c
    $$
- **Amortized Cost**: $$O(1)$$.

    The amortized cost is at most  
    $$
    O(C)+4-c = O(1).
    $$

## Reference
- Thomas H. Cormen, Charles Eric. Leiserson, Ronald L. Rivest, and Clifford Stein. 2001. Introduction to algorithms, Cambridge, MA: MIT Press.
- Fibonacci heap. Wikipedia (March 2017). Retrieved April 10, 2017 from https://en.wikipedia.org/wiki/Fibonacci_heap
