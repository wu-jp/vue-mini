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

    // 移除不存在的元素
    for (let i = 0; i < oldChildren.length; i++) {
      const oldVNode = oldChildren[i]

      // 拿到旧子节点 oldVNode 去新的一组子节点中寻找具有相同 key 值的节点
      const has = newChildren.find(vnode => vnode.key === oldVNode.key)

      if (!has) {
        // 如果没有找到具有相同 key 值的节点，则说明需要删除该节点了
        // 调用unmount函数将其卸载
        unmount(oldVNode)
      }
    }
  }
}
