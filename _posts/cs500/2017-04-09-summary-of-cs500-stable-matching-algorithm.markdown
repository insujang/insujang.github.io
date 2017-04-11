---
layout: post
title: "Summary of CS500: Stable Matching Algorithm"
date: "2017-04-09 15:49:25 +0900"
author: "Insu Jang"
tags: [study, cs500]
math: true
---
# Stable Marriage Algorithm (Stable Matching Algorithm)

Find a stable matching between two equally sized sets of elements given an ordering of preferences for each element.

The stable marriage problem has been stated as follows:

**Unstable**
: Tuple $$(w, m')$$ is *unstable* if $$w$$ perfers $$m'$$ over assigned $$m$$ and $$m'$$ prefers $$w$$ over assigned $$w'$$.

> Given $$n$$ mean and $$n$$ women, where each person has ranked all members of the opposite gender in order of preference, marry the men and women together such that there are no two people of opposite gender who would both rather have each other than teir current partners. When there are no such pairs of people, the set of marriages is deemed stable.

- The runtime complexity is $$O(n^2)$$ where $$n$$ is the number of men of women.
- The algorithm guarantees that
    1. **Everyone gets married**: There cannot be a man and a woman both unengaged, as he must have proposed to her at some point, and, if she is proposed to, she would necessarily be engaged thereafter.
    2. **The marriages are stable**: Let Alice and Bob both be engaged, but not to each other.

    Upon completion of the algorithm, it is not possible for both Alice and Bob to prefer each other over their current partners.

### Algorithm
#### Pseudocode
```
Gale-Shapley (1962)
M := {}
WHILE some m is unmatched
  Let m propose to w := first on m's list
  that m has not yet proposed to.
  IF w is unmatched
    add (m,w) to M
  ELIF w prefers m to current partner m'
    replace (m',w) in M with (m,w)
  ELSE
    w rejects proposal from m.
ENDWHILE // output: M
```

#### Implementation (Java)
```java
/**
 * Finds a Stable Matching using Gale-Shapley algorithm.<br>
 * This function explicitly takes two arguments, women and men.<br>
 * All of women and men in women and men may have their partner after this function is successfully finished.<br>
 * Your assignment will score according to the men field which will be return after the function call.<br>
 * Keeping this in mind, please complete this function.
 * @param men
 * Array of n men.
 * @param women
 * Array of n women.
 */
public ArrayList<Man> findStableMatching (ArrayList<Woman> women, ArrayList<Man> men) {
    // Should return men with its 'partner' member assigned in this function.
    Queue<Man> queue = new LinkedList<>();
    for(int i=0; i<men.size(); i++) {
      queue.add(men.get(i));
    }

    while(!queue.isEmpty()) {
        Man man = queue.remove();

        // First woman on m's list that m has not yet proposed to.
        Woman woman = women.get(man.preferenceRank[man.nProposals]);

        // if woman is unmatched
        if(woman.partner < 0) {
            woman.partner = man.number;
            man.partner = woman.number;
        }
        // else if w prefers this man to current partner
        // Loader.java sets lower preference for "prefer man".
        else if (woman.preferenceOf[man.number] < woman.preferenceOf[woman.partner]) {
            // replace the partner of the woman to this man
            // enqueue current partner into queue (divorced..)
            Man replacedMan = men.get(woman.partner);
            replacedMan.partner = -1;
            queue.add(replacedMan);

            // add partner
            woman.partner = man.number;
            man.partner = woman.number;
        }
        // else, woman rejects proposal from man.
        // enqueue this man again into queue, as he could married.
        else {
            queue.add(man);
        }

        // Increse man's number of proposal.
        man.nProposals++;
    }

    return men;
}
```

### Proof of correctness
- **Observation 1**: Once a woman is matched, ***she never becomes unmatched***.  
She only "trades up".
- **Observation 2**: Any man proposes to weomen in decreasing order of preference.

Using the above observations, we prove the following three claims.

- **Claim 1**: Algorithm terminates after at most $$n^2$$ iterations of while loop.
    > Proof of termination

    **Proof**: Each time through the while loop a man proposes to **a new woman**. There are only $$n^2$$ possible proposals.
- **Claim 2**: All men and women get matched.
    > Proof of perfection

    **Proof**: Proof by contradiction.

    - Suppose, Zeus is not matched upon termination of the algorithm.
    - Then some woman, say Amy, is not matched upon termination (because only $$n-1$$ men are matched)
    - By **observation 1**, Amy was never proposed to.
    - But, Zeus proposes to everyone, since he ends up unmatched.
- **Claim 3**: There are no unstable pairs.
    > Proof of stability

    **Proof**: Suppose the matching $$S*$$ does not contain the pair A-Z.

    - **Case 1**: Z never proposed to A.  
        = Z prefers his partner B to A.  
        = A-Z is stable.
    - **Case 2**: Z proposed to A.  
        = A rejected Z.  
        = A prefers her partner Y to Z.
        = A-Z is stable.

        In either case, the pair A-Z is ***stable***.

Gale-Shapley algorithm produces that stable matching where every $$m$$ gets assigned his *most* preferred choice among all $$w$$ matched to him in any stable macthing; whereas $$w$$ gets assigned her *least* preferred choice.

## Reference
Stable Matching. Princeton University. https://www.cs.princeton.edu/courses/archive/spring13/cos423/lectures/01StableMatching-2x2.pdf
