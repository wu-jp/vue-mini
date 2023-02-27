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
