---
layout: post
title: "Summary of CS500: Binomial Heap"
date: "2017-04-11 10:11:25 +0900"
author: "Insu Jang"
tags: [study,cs500]
math: true
---

# Binomial Trees
The binomial tree $$ B_k $$ is an ordered tree defined recursively.
- Binomial tree or order 0 $$ B_0 $$ consists of a single node.
- The binomial tree $$ B_k $$ consists of two binomial trees $$B_{k-1} $$ that are linked together: the root of one is the leftmost child of the root of the other.
- A binomial tree of order $$ k $$ has a root node whose children are roots of binomial trees of orders $$ k-1, k-2, ..., 2, 1, 0 $$ (in this order).

![binomial_tree](</assets/images/170409/binomial_tree.png>){: .center-image width="800px"}

![](https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Binomial_Trees.svg/1000px-Binomial_Trees.svg.png){: .center-image width="800px"}
* Binomial trees of order 0 to 3.
{: .center}

order
: The order of a binomial tree $$ B_k $$ is $$ k $$.  
A binomial tree of order $$ k$$ has $$ 2^k $$ nodes, and height $$ k $$.

degree
: The number of child trees that the node has.  
Same number with order.

## Some properties of binomial tree
For the binomial tree $$ B_k $$,

1. There are $$ 2^k $$ nodes
2. The height of the tree is $$ k $$
3. There are exactly $$ \binom{N}{k} $$ nodes at depth $$ i $$ for $$ i = 0, 1, ..., k $$
4. The root has degree $$ k $$, where $$ k > $$ the degree of any other node.  
**If the children of the root are numbered from right to left by $$0, 1, ..., k-1$$, then child $$i$$ is the root of subtree $$B_i$$.**

# Binomial Heaps
A binomial heap $$ H $$ is a forest of binomial trees that satisfies the following ***binomial-heap properties.***

1. Each binomial tree obeys the *min-heap property*  
**Min-heap property:** The key of node $$>=$$ the key of its parent.  
Each such tree is called *min-heap ordered*.
2. For any k $$ (k >= 0) $$, there is at most one binomial tree whose root has degree $$k$$.

Binomial tress in the binomial heap are ***sorted by ascending number of children***.

![binomial_heap](http://staff.ustc.edu.cn/~csli/graduate/algorithms/book6/404_a.gif){: .center-image width="800px"}
* An example of binomial heap with $$ n = 13 $$ nodes.
{: .center}

## Operations of binomial Heaps
1. Creating a new binomial heap ($$ \Theta(1) $$)
2. Finding the minimum node ($$ \Theta(lg_{}n) $$)
3. Merging two binomial heaps ($$ O(lg_{}n) $$)
4. Inserting a node (<!--\Theta(1)-->$$ O(lg_{}n) $$)
5. Decreasing a key ($$ O(lg_{}n) $$)
6. Extracting a key ($$ \Theta(lg_{}n) $$)


### 1. Creating a new binomial heap (`MakeBinomialHeap()`)
Allocates and returns an object `H`, where `H.head = null`.  
The running time is $$\Theta(1)$$.

### 2. Finding the minimum key (`BinomialHeapFindMin(H)`)
Assume that there are no keys with value infinity.

The minimum key must reside in a root node. It checks all roots, which number at most $$log_{}n + 1$$.  
The running time is $$O(log_{}n)$$.

### 3. Merging two binomial heap (`BinomialHeapMerge(H1,H2)`)
`BinomialHeapMerge()` has two phases.

1. Merge the root lists of binomial heaps $$H_1$$ and $$H_2$$ into a single linked list $$H$$ that is sorted by degree into monotonically increasing order.  
**There might be as many as two roots of each degree.**
    ![binomial_heap_merge1](/assets/images/170409/binomial_heap_merge1.png){: .center-image width="800px"}
    * A new sinle linked list has all root lists in $$H_1$$ and $$H_2$$.
    {: .center}
2. Links roots of equal degree until at most one root remains of each degree.
    **`Link(x, y)`** merges two binomial trees into one whoose roots have the same degree.  
    `Link(x, y)` has $$O(1)$$ time because it just compares two roots and links one to the other.
    ![link](https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Binomial_heap_merge1.svg/200px-Binomial_heap_merge1.svg.png){: .center-image}
    * Link operation between two binomial trees with the same degree or order.
    {: .center}

    ![binomial_heap_merge2](/assets/images/170409/binomial_heap_merge2.png){: .center-image width="800px"}
    * Make all binomial trees have distinct degree.
    {: .center}

The running time of `BinomialHeapMerge(H1, H2)` is $$O(lg_{}n)$$, where $$n$$ is the total number of nodes in binomial heaps $$H_1$$, and $$H_2$$.

$$H_1$$ contains at most $$log_{}{n_1}+1$$ roots and $$H_2$$ contains at most $$log_{}{n_2}+1$$ roots, so $$H$$ contains **at most $$log_{}{n_1}+log_{}{n_2}+2 \le 2 \cdot log_{}{n}+2=O(log_{}n)$$ roots** immediately after the call of `BinomialHeapMerge(H1, H2)`. Each iteration takes $$O(1)$$ time, so there are at most $$log_{}{n_1}+log_{}{n_2}+2$$ iterations.

![log_average](/assets/images/170409/log_average.png){: .center-image width="700px"}

Thus the total time is $$O(log_{}n)$$.

### 4. Inserting the node (`BinomialHeapInsert(H, x)`)
Inserting the node consists of two phases.
1. Create a new binomial heap, with one element $$x$$ to be put.
    Putting an element $$x$$ to the heap is simple: set `H.head = x`, instead of setting `H.head = null`. This takes $$O(1)$$ time.
2. Merge this heap with the existing heap. This operation uses `BinomialHeapMerge(H1,H2)`, which consumes $$O(log_{}n)$$ running time.

The total running time is $$O(log_{}n)$$.

> Binomial Heap은 binary counter로 표현할 수 있으므로, inserting the node는 binary counter에서 increment하는 것과 같다.

### 5. Decreasing a key (`BinomialHeapDecreaseKey(H, x, k)`)
The procedure of decreasing a key is in the same manner as in a binary min-heap: by ***bubble-up*** the key in the heap.

After assigning the new key to $$x$$, the procedure goes up the tree.  
`x.key` is checked against the key of $$x$$'s parent $$y$$. If $$x$$ is the root or `x.key` $$\ge$$ `y.key`, the binomial tree is now min-heap-ordered.

![binomial_heap_decr_key](/assets/images/170409/binomial_heap_decr_key.png){: .center-image width="800px"}
* Procedure of decreasing a key with a binomial heap
{: .center}

As the maximum depth of $$x$$ is $$log_{}n$$, so the bubbling iterates at most $$log_{}n$$ times, thus the running time of $$O(log_{}n)$$.

### 6. Deleting a key (`BinomialHeapDelete(H, x)`)
#### 6.1. Deleting the minimum key(`BinomialHeapExtractMin(H)`)
To explain the procedure or deleting an arbitrary key, we first need to explore how deleting the minimum key is done.

1. Remove the minimum key `x` from the root list of $$H$$ and **create a new binomial heap, roots of which are children of `x`**.
2. Now we have two binomial heaps. Merge two heaps to create a new binomial heap.

![binomial_heap_delete_min](/assets/images/170409/binomial_heap_delete_min.png){: .center-image width="800px"}
* Procedure of deleting the minimum key. It includes merging two binomial heaps.  
The binomial heap on the right of (c) is made from deleting the node `x`.  
{: .center}

> Note that binomial trees in the binomial heap on the right of (c) are sorted in ascending number of children, hence reversed order.

The running time for `BinomialHeapExtractMin(H)` is $$O(log_{}n)$$, because
1. Creating a new binomial heap takes $$O(1)$$ time, as they are already connected as a single linked list.
2. Merging two binomial heaps taks $$O(log_{}n)$$ time.

#### 6.2. Deleting a key (`BinomialHeapDelete(H, x)`)
Deleting a key consists of two phases:
1. `BinomialHeapDecreaseKey(H, x, -inf)` ($$O(log_{}n)$$)
2. `BinomialHeapExtractMin(H)` ($$O(log_{}n)$$)

Hence, the running time for `BinomialHeapDelete(H, x)` is also $$O(log_{}n)$$.

## Reference
- Thomas H. Cormen, Charles Eric. Leiserson, Ronald L. Rivest, and Clifford Stein. 2001. Introduction to algorithms, Cambridge, MA: MIT Press.
- Binomial heap. Wikipedia (January 2017). Retrieved April 10, 2017 from https://en.wikipedia.org/wiki/Binomial_heap
