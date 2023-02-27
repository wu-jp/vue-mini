# 简答 Diff 算法

当新旧 vnode 的子节点都是一组节点时，为了最小的性能开销完成更新，需要比较两组子节点，用于比较的算法叫作 Diff 算法。

## 1. 减少 DOM 操作的性能开销

oldChildren 和 newChildren 分别是旧的一组子节点和新的一组子节点。**我们遍历其中长度较短的那一组**，并将两者中对应位置的节点分别传递给 patch 函数进行更新。patch 函数在执行更新时，发现新旧子节点只有文本内容不同，因此只会更新其文本节点的内容。接着，**再对比新旧两组子节点的长度，如果新的一组子节点更长，则说明有新子节点需要挂载，否则说明有旧子节点需要卸载**。

```js
function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    const oldLen = oldChildren.length
    const newLen = oldChildren.length

    const commonLength = Math.min(oldLen, newLen)

    // 更新子节点
    for (let i = 0; i < commonLength; i++) {
      patch(oldChildren[i], newChildren[i], container)
    }

    // 如果新子节点的数量更多，有新的子节点需要挂载
    if (newLen > oldLen) {
      for (let i = commonLength; i < newLen; i++) {
        patch(null, newChildren(i), container)
      }
    } else if (oldLen > newLen) {
      // 说明有旧的子节点需要卸载
      for (let i = commonLength; i < oldLen; i++) {
        unmount(oldChildren[i])
      }
    }
  }
}
```

## 2. DOM 复用和 key 的作用

```js
// oldChildren
[
  {type: 'p', children: '1', key: 1}
  {type: 'p', children: '2', key: 2}
  {type: 'p', children: '3', key: 3}
]

// newChildren
[
  {type: 'p', children: '3', key: 3}
  {type: 'p', children: '1', key: 1}
  {type: 'p', children: '2', key: 2}
]
```

key 属性就像虚拟节点的“身份证”号，只要两个虚拟节点的 type 属性值和 key 属性值都相同，那么我们就认为它们是相同的，即可以进行 DOM 的复用。

有必要强调的一点是，DOM 可复用并不意味着不需要更新。

移动 DOM 之前，我们需要先完成打补丁操作。

```js
function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    for (let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]

      for (let j = 0; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if (newVNode.key === oldVNode.key) {
          patch(oldVNode, newVNode, container)
          break
        }
      }
    }
  }
}
```

## 3. 找到需要移动的元素

```js
function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    // 用来存储寻找过程中遇到的最大索引值
    let lastIndex = 0

    for (let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]

      for (let j = 0; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if (newVNode.key === oldVNode.key) {
          patch(oldVNode, newVNode, container)

          if (j < lastIndex) {
            // 如果当前找到的节点在旧 children 中的索引小于最大索引值 lastIndex
            // 说明该节点对应的真实DOM需要移动
            // TODO 需要移动
          } else {
            // 如果当前找到的节点在旧 children 中的索引不小于最大索引值，则更新 lastIndex 的值
            lastIndex = j
          }

          break
        }
      }
    }
  }
}
```

如果新旧节点的 key 值相同，说明我们在旧 children 中找到了可复用 DOM 的节点。此时我们用该节点在旧 children 中的索引 j 与 lastIndex 进行比较，如果 j 小于lastIndex，说明当前 oldVNode 对应的真实 DOM 需要移动，否则说明不需要移动。但此时应该将变量 j 的值赋给变量 lastIndex，以保证寻找节点的过程中，变量 lastIndex 始终存储着当前遇到的最大索引值。

## 4. 如何移动元素

```js
function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    let lastIndex = 0

    for (let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]
      let j = 0
      for (j; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if (newVNode.key === oldVNode.key) {
          patch(oldVNode, newVNode, container)

          if (j < lastIndex) {
            // 如果当前找到的节点在旧 children 中的索引小于最大索引值 lastIndex
            // 说明该节点对应的真实DOM需要移动

            // 获取 newVNode 的前一个vnode，即 pervVNode
            const pervVNode = newChildren[i - 1]

            // 如果 pervVNode 不存在，则说明当前 newVNode 是第一个节点，它不需要移动
            if (pervVNode) {
              // 我们要将 newVNode 对应的真实DOM移动到 PrevVNode 所对应的真实 DOM 后面
              // 所以需要获取 prevVnode 所对应真实DOM的下一个兄弟节点，并将其作为锚点
              const anchor = pervVNode.el.nextSibling
              // 调用 insert 方法将 newVNode 对应的真实 DOM 插入到锚点元素前面
              // 也就是 prevVNode 对应的真实 DOM 的后面
              insert(newVNode.el, container, anchor)
            }

          } else {
            // 如果当前找到的节点在旧 children 中的索引不小于最大索引值，则更新 lastIndex 的值
            lastIndex = j
          }

          break
        }
      }
    }
  }
}
```

如果条件 j < lastIndex 成立，则说明当前 newVNode 所对应的真实 DOM 需要移动。我们需要获取当前 newVNode 节点的前一个虚拟节点，即newChildren[i - 1]，然后使用 insert 函数完成节点的移动，其中 insert 函数依赖浏览器原生的insertBefore 函数

## 5. 添加新元素

```js
function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    let lastIndex = 0

    for (let i = 0; i < newChildren.length; i++) {
      const newVNode = newChildren[i]

      let j = 0

      // 在第一层循环中定义一个变量find，代表是否在旧的一组子节点中找到可复用的节点
      // 初始值为false, 代表没找到
      let find = false

      for (j; j < oldChildren.length; j++) {
        const oldVNode = oldChildren[j]

        if (newVNode.key === oldVNode.key) {
          // 一旦找到可复用的系欸但，则变量 find 值为 true
          find = true
          patch(oldVNode, newVNode, container)

          if (j < lastIndex) {
            // 如果当前找到的节点在旧 children 中的索引小于最大索引值 lastIndex
            // 说明该节点对应的真实DOM需要移动

            // 获取 newVNode 的前一个vnode，即 pervVNode
            const pervVNode = newChildren[i - 1]

            // 如果 pervVNode 不存在，则说明当前 newVNode 是第一个节点，它不需要移动
            if (pervVNode) {
              // 我们要将 newVNode 对应的真实DOM移动到 PrevVNode 所对应的真实 DOM 后面
              // 所以需要获取 prevVnode 所对应真实DOM的下一个兄弟节点，并将其作为锚点
              const anchor = pervVNode.el.nextSibling
              // 调用 insert 方法将 newVNode 对应的真实 DOM 插入到锚点元素前面
              // 也就是 prevVNode 对应的真实 DOM 的后面
              insert(newVNode.el, container, anchor)
            }

          } else {
            // 如果当前找到的节点在旧 children 中的索引不小于最大索引值，则更新 lastIndex 的值
            lastIndex = j
          }

          break
        }
      }

      // 当前newVNode 没有在旧的一组子节点中找到可复用的节点
      // 也就是说，当前 newValue 是新增节点，需要挂载
      if (!find) {
        // 为了将节点挂载到准确的位置，我们需要先获取锚点元素
        const prevVNode = newChildren[i - 1]
        let anchor = null

        if (pervVNode) {
          anchor = pervVNode.el.nextSibling
        } else {
          // 如果没有前一个节点，说明将挂载在第一个位置
          // 将容器元素的 firstChild 作为锚点
          anchor = container.firstChild
        }

        patch(null, newVNode, container, anchor)
      }
    }
  }
}
```

我们在外层循环中定义了名为 find 的变量，它代表渲染器能否在旧的一组子节点中找到可复用的节点。变量 find 的初始值为 false，一旦寻找到可复用的节点，则将变量find 的值设置为 true。如果内层循环结束后，变量 find 的值仍然为 false，则说明当前 newVNode 是一个全新的节点，需要挂载它。为了将节点挂载到正确位置，我们需要先获取锚点元素：找到newVNode 的前一个虚拟节点，即 prevVNode，如果存在，则使用它对应的真实 DOM 的下一个兄弟节点作为锚点元素；如果不存在，则说明即将挂载的 newVNode 节点是容器元素的第一个子节点，此时应该使用容器元素的 container.firstChild 作为锚点元素。最后，将锚点元素 anchor 作为patch 函数的第四个参数，调用 patch 函数完成节点的挂载。

由于目前实现的 patch 函数还不支持传递第四个参数，所以我们需要调整 patch 函数的代码:

```js
// patch 函数需要接收第四个参数，即锚点元素
function patch(n1, n2, container, anchor) {
  // 省略部分代码

  if (typeof type === 'string') {
    if (!n1) {
      // 挂载时将锚点元素作为第三个参数传递给 mountElement 函数
      mountElement(n2, container, anchor)
    } else {
      patchElement(n1, n2)
    }
  } else if (type === Text) {
    // 省略部分代码
  } else if (type === Fragment) {
    // 省略部分代码
  }
}

// mountElement 函数需要增加第三个参数，即锚点元素
function mountElement(vnode, container, anchor) {
  // 省略部分代码

  // 在插入节点时，将锚点元素透传给 insert 函数
  insert(el, container, anchor)
}
```

## 6. 移除不存在的元素

当基本的更新结束时，我们需要遍历旧的一组子节点，然后去新的一组子节点中寻找具有相同 key 值的节点。如果找不到，则说明应该删除该节点。

```js
function patchChildren(n1, n2, container) {
  if (Array.isArray(n2.children)) {
    const oldChildren = n1.children
    const newChildren = n2.children

    let lastIndex = 0

    for (let i = 0; i < newChildren.length; i++) {
      // 忽略部分代码
    }

    // 移除不存在的元素
    for (let i = 0; i < oldChildren.length; i++) {
      const oldVNode = oldChildren[i]

      // 拿到旧子节点 oldVNode 去新的一组子节点中寻找具有相同 key 值的节点
      const has = newChildren.find(vnode => vnode.key === oldVNode.key)

      if (!has) {
        // 如果没有找到具有相同 key 值的节点，则说明需要删除该节点了
        // 调用 unmount 函数将其卸载
        unmount(oldVNode)
      }
    }
  }
}

```

如以上代码及注释所示，在上一步的更新操作完成之后，我们还需要遍历旧的一组子节点，目的是检查旧子节点在新的一组子节点中是否仍然存在，如果已经不存在了，则调用 unmount 函数将其卸载。
