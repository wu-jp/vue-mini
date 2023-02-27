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
